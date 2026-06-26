"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  FileDown,
  Eye,
  Save,
  Check,
  BookmarkPlus,
  ListPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import type { Dict } from "@/lib/i18n";
import type { Cliente, Tenant, OrcamentoItem, Servico } from "@/lib/types";
import {
  TemplateClassico,
  TemplateModerno,
  TemplateSimples,
  type TipoTemplate,
} from "./orcamento-templates";

type ServicoItem = {
  id: string;
  descricao: string;
  valor: string;
};

type OpcaoPagamento = "unico" | "entrada_restante" | "parcelado";
type TipoParcelamento = "iguais" | "entrada_diferenciada";
type TipoEntrada = "percentual" | "valor";

export type FormState = {
  cliente_id: string;
  cliente_nome: string;
  cliente_email: string;
  cliente_telefone: string;
  cliente_documento: string;
  cliente_endereco: string;
  servicos: ServicoItem[];
  nota: string;
  // ── Pagamento ──
  opcao_pagamento: OpcaoPagamento;
  percentual_entrada: string; // Opção 2 (entrada + restante)
  parcelas: string; // Opção 3 (2 a 12)
  tipo_parcelamento: TipoParcelamento; // Opção 3
  entrada_tipo: TipoEntrada; // Opção 3 — entrada diferenciada
  entrada_valor: string; // Opção 3 — valor ou % da entrada diferenciada
  // ── Apresentação ──
  template: TipoTemplate; // modelo visual do PDF
};

/** Campos de pagamento reutilizáveis guardados em um modelo. */
type PagamentoModelo = Pick<
  FormState,
  | "opcao_pagamento"
  | "percentual_entrada"
  | "parcelas"
  | "tipo_parcelamento"
  | "entrada_tipo"
  | "entrada_valor"
>;

/** Modelo de orçamento reutilizável — sem dados do cliente. */
type ModeloOrcamento = {
  id: string;
  nome: string;
  itens: OrcamentoItem[];
  pagamento: Partial<PagamentoModelo> | null;
  observacoes: string | null;
};

const emptyForm: FormState = {
  cliente_id: "",
  cliente_nome: "",
  cliente_email: "",
  cliente_telefone: "",
  cliente_documento: "",
  cliente_endereco: "",
  servicos: [{ id: "1", descricao: "", valor: "" }],
  nota: "",
  opcao_pagamento: "unico",
  percentual_entrada: "50",
  parcelas: "2",
  tipo_parcelamento: "iguais",
  entrada_tipo: "percentual",
  entrada_valor: "30",
  template: "classico",
};

/** Plano de pagamento calculado a partir do total e das escolhas do formulário. */
export type PlanoPagamento =
  | { tipo: "unico"; resumo: string }
  | {
      tipo: "entrada_restante";
      pct: number;
      entrada: number;
      restante: number;
      resumo: string;
    }
  | {
      tipo: "parcelado";
      n: number;
      subtipo: TipoParcelamento;
      pctEntrada: number;
      parcelas: { numero: number; valor: number; entrada: boolean }[];
      resumo: string;
    };

function gerarNumero() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `ORC-${yy}${mm}-${seq}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Converte o total + escolhas de pagamento em um plano estruturado.
 * Usado tanto na prévia/PDF quanto na hora de salvar no banco.
 * Os resumos saem localizados (dict) e formatados na moeda do tenant (fmt).
 */
function calcularPlano(
  total: number,
  form: FormState,
  dict: Dict,
  fmt: (v: number) => string,
): PlanoPagamento {
  if (form.opcao_pagamento === "entrada_restante") {
    const pct = clamp(parseFloat(form.percentual_entrada) || 0, 0, 100);
    const entrada = (total * pct) / 100;
    const restante = total - entrada;
    return {
      tipo: "entrada_restante",
      pct,
      entrada,
      restante,
      resumo: dict.resumo.entradaRestante(pct, fmt(entrada), fmt(restante)),
    };
  }

  if (form.opcao_pagamento === "parcelado") {
    const n = clamp(parseInt(form.parcelas, 10) || 2, 2, 12);

    if (form.tipo_parcelamento === "entrada_diferenciada") {
      const bruto =
        form.entrada_tipo === "percentual"
          ? (total * (parseFloat(form.entrada_valor) || 0)) / 100
          : parseFloat(form.entrada_valor) || 0;
      const entrada = clamp(bruto, 0, total);
      const pctEntrada = total > 0 ? (entrada / total) * 100 : 0;
      const nRest = n - 1;
      const valorRest = nRest > 0 ? (total - entrada) / nRest : 0;
      const parcelas = [
        { numero: 1, valor: entrada, entrada: true },
        ...Array.from({ length: nRest }, (_, i) => ({
          numero: i + 2,
          valor: valorRest,
          entrada: false,
        })),
      ];
      return {
        tipo: "parcelado",
        n,
        subtipo: "entrada_diferenciada",
        pctEntrada,
        parcelas,
        resumo: dict.resumo.entradaDif(fmt(entrada), nRest, fmt(valorRest)),
      };
    }

    const valor = total / n;
    const parcelas = Array.from({ length: n }, (_, i) => ({
      numero: i + 1,
      valor,
      entrada: false,
    }));
    return {
      tipo: "parcelado",
      n,
      subtipo: "iguais",
      pctEntrada: 0,
      parcelas,
      resumo: dict.resumo.parcelado(n, fmt(valor)),
    };
  }

  return {
    tipo: "unico",
    resumo: dict.resumo.unico(fmt(total)),
  };
}

const inputCls =
  "w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1";

export function OrcamentosManager() {
  const supabase = createClient();
  const previewRef = useRef<HTMLDivElement>(null);
  const { dict, fmt, simbolo, moeda, data: fmtDataLocal } = useI18n();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [modelos, setModelos] = useState<ModeloOrcamento[]>([]);
  const [salvandoModelo, setSalvandoModelo] = useState(false);
  const [catalogo, setCatalogo] = useState<Servico[]>([]);
  // Id da linha de serviço cujo seletor de catálogo está aberto (ou null).
  const [catalogoAbertoId, setCatalogoAbertoId] = useState<string | null>(null);

  const [showPreview, setShowPreview] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [numero, setNumero] = useState("");
  // Link público de pagamento + QR (gerados após salvar, p/ aparecer no PDF).
  const [linkPagamento, setLinkPagamento] = useState<string | null>(null);
  const [qrPagamento, setQrPagamento] = useState<string | null>(null);
  // Data fixada na montagem; o rótulo é formatado conforme o idioma do tenant.
  const [hoje] = useState(() => new Date());
  const dataHoje = fmtDataLocal(hoje);

  // Autocomplete de clientes no campo Nome.
  const [sugestoes, setSugestoes] = useState<Cliente[]>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const buscaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregarContexto = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // Resolve o tenant do usuário logado.
    const { data: userRow } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const tId = userRow?.tenant_id as string | undefined;
    if (!tId) return;
    setTenantId(tId);

    // Carrega dados do tenant para personalizar o cabeçalho do orçamento.
    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", tId)
      .single();
    if (tenantRow) setTenant(tenantRow as Tenant);

    // Clientes do tenant (RLS já restringe ao tenant atual).
    const { data: clientesRows } = await supabase
      .from("clientes")
      .select("*")
      .order("nome");
    if (clientesRows) setClientes(clientesRows as Cliente[]);

    // Modelos de orçamento do tenant (RLS já restringe ao tenant atual).
    const { data: modelosRows } = await supabase
      .from("modelos_orcamento")
      .select("id, nome, itens, pagamento, observacoes")
      .order("nome");
    if (modelosRows) setModelos(modelosRows as ModeloOrcamento[]);

    // Catálogo "Meus Serviços" do tenant (RLS já restringe ao tenant atual).
    const { data: servicosRows } = await supabase
      .from("servicos")
      .select("*")
      .order("nome");
    if (servicosRows) setCatalogo(servicosRows as Servico[]);
  }, [supabase]);

  useEffect(() => {
    carregarContexto();
    setNumero(gerarNumero());
  }, [carregarContexto]);

  function selecionarCliente(id: string) {
    const c = clientes.find((c) => c.id === id);
    setForm((f) => ({
      ...f,
      cliente_id: id,
      cliente_nome: c?.nome ?? "",
      cliente_email: c?.email ?? "",
      cliente_telefone: c?.telefone ?? "",
      cliente_documento: c?.documento ?? "",
      cliente_endereco: c?.endereco ?? "",
    }));
  }

  /**
   * Digitação no campo Nome com autocomplete.
   * Ao atingir 3+ caracteres, busca clientes do tenant por nome (ilike),
   * com debounce para não disparar a cada tecla. Editar o nome desvincula
   * o cliente selecionado (cliente_id) — um novo cliente pode ser cadastrado
   * ao salvar se ele não existir.
   */
  function onNomeChange(value: string) {
    setForm((f) => ({ ...f, cliente_id: "", cliente_nome: value }));
    setSalvo(false);

    if (buscaTimerRef.current) clearTimeout(buscaTimerRef.current);

    const termo = value.trim();
    if (termo.length < 3 || !tenantId) {
      setSugestoes([]);
      setMostrarSugestoes(false);
      return;
    }

    buscaTimerRef.current = setTimeout(async () => {
      // RLS já restringe ao tenant; o eq explícito deixa a intenção clara.
      const { data } = await supabase
        .from("clientes")
        .select("*")
        .eq("tenant_id", tenantId)
        .ilike("nome", `%${termo}%`)
        .order("nome")
        .limit(8);
      setSugestoes((data as Cliente[]) ?? []);
      setMostrarSugestoes(true);
    }, 300);
  }

  /** Preenche todos os dados a partir de um cliente sugerido. */
  function aplicarSugestao(c: Cliente) {
    setForm((f) => ({
      ...f,
      cliente_id: c.id,
      cliente_nome: c.nome,
      cliente_email: c.email ?? "",
      cliente_telefone: c.telefone ?? "",
      cliente_documento: c.documento ?? "",
      cliente_endereco: c.endereco ?? "",
    }));
    setSugestoes([]);
    setMostrarSugestoes(false);
    setSalvo(false);
  }

  function addServico() {
    setForm((f) => ({
      ...f,
      servicos: [
        ...f.servicos,
        { id: crypto.randomUUID(), descricao: "", valor: "" },
      ],
    }));
  }

  function removeServico(id: string) {
    setForm((f) => ({
      ...f,
      servicos: f.servicos.filter((s) => s.id !== id),
    }));
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSalvo(false);
  }

  function updateServico(id: string, field: "descricao" | "valor", value: string) {
    setForm((f) => ({
      ...f,
      servicos: f.servicos.map((s) =>
        s.id === id ? { ...s, [field]: value } : s,
      ),
    }));
    setSalvo(false);
  }

  /**
   * Preenche uma linha de serviço a partir de um item do catálogo "Meus
   * Serviços": copia nome -> descrição e preço -> valor. Fecha o dropdown.
   */
  function aplicarServicoCatalogo(linhaId: string, servico: Servico) {
    setForm((f) => ({
      ...f,
      servicos: f.servicos.map((s) =>
        s.id === linhaId
          ? { ...s, descricao: servico.nome, valor: String(servico.preco) }
          : s,
      ),
    }));
    setCatalogoAbertoId(null);
    setSalvo(false);
  }

  const total = form.servicos.reduce(
    (sum, s) => sum + (parseFloat(s.valor) || 0),
    0,
  );
  const plano = calcularPlano(total, form, dict, fmt);

  /**
   * Salva os campos reutilizáveis do formulário (itens, pagamento e
   * observações — SEM dados do cliente) como um modelo na tabela
   * modelos_orcamento. Pede um nome via prompt e atualiza a lista local.
   */
  async function salvarComoModelo() {
    if (!tenantId) {
      setErro(dict.orc.erroTenant);
      return;
    }
    const itens: OrcamentoItem[] = form.servicos
      .filter((s) => s.descricao || s.valor)
      .map((s) => ({ descricao: s.descricao, valor: parseFloat(s.valor) || 0 }));
    if (itens.length === 0) {
      setErro(dict.orc.erroServicoModelo);
      return;
    }

    const nome = window.prompt(dict.orc.nomeModeloPrompt)?.trim();
    if (!nome) return; // cancelado ou vazio

    setSalvandoModelo(true);
    setErro(null);

    const pagamento: PagamentoModelo = {
      opcao_pagamento: form.opcao_pagamento,
      percentual_entrada: form.percentual_entrada,
      parcelas: form.parcelas,
      tipo_parcelamento: form.tipo_parcelamento,
      entrada_tipo: form.entrada_tipo,
      entrada_valor: form.entrada_valor,
    };

    const { data, error } = await supabase
      .from("modelos_orcamento")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        nome,
        itens,
        pagamento,
        observacoes: form.nota || null,
      })
      .select("id, nome, itens, pagamento, observacoes")
      .single();

    if (error) {
      console.error("[salvarComoModelo] erro ao salvar modelo:", error);
      setErro(dict.orc.erroSalvarModelo);
    } else if (data) {
      // Insere na lista local mantendo a ordenação por nome.
      const novo = data as ModeloOrcamento;
      setModelos((atuais) =>
        [...atuais, novo].sort((a, b) =>
          a.nome.localeCompare(b.nome, undefined, { sensitivity: "base" }),
        ),
      );
    }
    setSalvandoModelo(false);
  }

  /**
   * Aplica um modelo ao formulário: preenche itens, pagamento e observações,
   * PRESERVANDO os dados do cliente já digitados (o modelo não os contém).
   */
  function carregarModelo(id: string) {
    if (!id) return;
    const m = modelos.find((x) => x.id === id);
    if (!m) return;

    const servicos: ServicoItem[] = (m.itens ?? []).map((it) => ({
      id: crypto.randomUUID(),
      descricao: it.descricao ?? "",
      valor: it.valor != null ? String(it.valor) : "",
    }));
    const pg = m.pagamento ?? {};

    setForm((f) => ({
      ...f, // preserva cliente_* já preenchidos
      servicos: servicos.length
        ? servicos
        : [{ id: crypto.randomUUID(), descricao: "", valor: "" }],
      nota: m.observacoes ?? "",
      opcao_pagamento: pg.opcao_pagamento ?? "unico",
      percentual_entrada: pg.percentual_entrada ?? "50",
      parcelas: pg.parcelas ?? "2",
      tipo_parcelamento: pg.tipo_parcelamento ?? "iguais",
      entrada_tipo: pg.entrada_tipo ?? "percentual",
      entrada_valor: pg.entrada_valor ?? "30",
    }));
    setSalvo(false);
  }

  // Cor de destaque do orçamento: cor primária do tenant ou fallback escuro.
  const cor = tenant?.cor_primaria || "#0F0F0F";
  const corSuave = `${cor}14`; // ~8% de opacidade (hex alpha)

  /**
   * Salva ou atualiza o cliente do orçamento na tabela "clientes".
   * Deduplica por tenant_id + e-mail (ou por nome, quando não há e-mail),
   * evitando criar clientes repetidos a cada orçamento salvo — mesma
   * semântica de um upsert por tenant_id + email.
   *
   * Falhas aqui são silenciosas de propósito: o orçamento já foi salvo com
   * sucesso e o cadastro do cliente é um efeito secundário, não deve quebrar
   * o fluxo principal nem sobrescrever o erro/sucesso do orçamento.
   *
   */
  async function salvarOuAtualizarCliente() {
    if (!tenantId) return;

    const nome = form.cliente_nome.trim();
    if (!nome) return; // sem nome não há cliente para cadastrar

    const email = form.cliente_email.trim();
    const telefone = form.cliente_telefone.trim();
    const documento = form.cliente_documento.trim();
    const endereco = form.cliente_endereco.trim();

    const dados = {
      nome,
      email: email || null,
      telefone: telefone || null,
      documento: documento || null,
      endereco: endereco || null,
    };

    try {
      // Procura cliente existente do mesmo tenant para não duplicar.
      // Chave preferencial: e-mail; sem e-mail, cai para o nome.
      const busca = supabase
        .from("clientes")
        .select("id")
        .eq("tenant_id", tenantId);

      const { data: existente } = await (email
        ? busca.eq("email", email)
        : busca.eq("nome", nome)
      )
        .limit(1)
        .maybeSingle();

      if (existente?.id) {
        // Atualiza apenas os campos vindos do formulário, preservando
        // documento/endereco já cadastrados.
        await supabase.from("clientes").update(dados).eq("id", existente.id);
      } else {
        const payload = { ...dados, tenant_id: tenantId, user_id: userId };
        const { data: inserido } = await supabase
          .from("clientes")
          .insert(payload)
          .select("*")
          .single();
        if (inserido) {
          // Adiciona o novo cliente ao state local (mantendo a ordenação por
          // nome do carregamento inicial) para que o autocomplete funcione
          // imediatamente, sem precisar recarregar a página.
          const novo = inserido as Cliente;
          setClientes((atuais) =>
            [...atuais, novo].sort((a, b) =>
              a.nome.localeCompare(b.nome, undefined, { sensitivity: "base" }),
            ),
          );
        }
      }
    } catch (e) {
      console.error("[salvarOuAtualizarCliente] exceção inesperada:", e);
    }
  }

  async function salvarOrcamento(): Promise<string | null> {
    if (!tenantId) {
      setErro(dict.orc.erroTenant);
      return null;
    }
    setSalvando(true);
    setErro(null);

    const itens: OrcamentoItem[] = form.servicos
      .filter((s) => s.descricao || s.valor)
      .map((s) => ({
        descricao: s.descricao,
        valor: parseFloat(s.valor) || 0,
      }));

    const { data, error } = await supabase
      .from("orcamentos")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        cliente_id: form.cliente_id || null,
        numero,
        titulo: form.cliente_nome
          ? `${dict.pdf.titulo} — ${form.cliente_nome}`
          : dict.pdf.titulo,
        itens,
        subtotal: total,
        desconto: 0,
        total,
        moeda,
        status: "rascunho",
        template: form.template,
        opcao_pagamento: form.opcao_pagamento,
        parcelas: plano.tipo === "parcelado" ? plano.n : 1,
        percentual_entrada:
          plano.tipo === "entrada_restante"
            ? plano.pct
            : plano.tipo === "parcelado" &&
              plano.subtipo === "entrada_diferenciada"
            ? Number(plano.pctEntrada.toFixed(2))
            : 0,
      })
      .select("id")
      .single();

    setSalvando(false);

    if (error) {
      setErro(dict.orc.erroSalvar(error.message));
      return null;
    }

    // Orçamento salvo com sucesso: salva/atualiza o cliente (efeito secundário,
    // não-bloqueante e silencioso em caso de falha).
    await salvarOuAtualizarCliente();

    setSalvo(true);
    return (data?.id as string) ?? null;
  }

  async function gerarPDF() {
    if (!previewRef.current) return;
    setGerando(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, imgWidth, imgHeight);

      // Link clicável real (o box rasterizado não é clicável no PDF). Posiciona
      // logo abaixo do conteúdo quando cabe na página, com fallback no rodapé.
      if (linkPagamento) {
        const linkY = Math.min(imgHeight + 6, 291);
        pdf.setFontSize(9);
        pdf.setTextColor(0, 102, 204);
        pdf.textWithLink(`→ ${linkPagamento}`, 12, linkY, { url: linkPagamento });
      }

      pdf.save(`orcamento-${form.cliente_nome || "cliente"}-${numero}.pdf`);
    } catch (e) {
      console.error(e);
    }
    setGerando(false);
  }

  async function salvarEGerar() {
    const id = await salvarOrcamento();

    // Se o orçamento foi salvo e o prestador tem Mercado Pago conectado, gera o
    // link público de pagamento + QR code e aguarda o DOM refletir antes do PDF.
    if (id && tenant?.mp_access_token) {
      const site = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const link = `${site}/pagar/${id}`;
      let qr: string | null = null;
      try {
        const QR = await import("qrcode");
        qr = await QR.toDataURL(link, { width: 240, margin: 1 });
      } catch (e) {
        console.error("[orcamentos] erro ao gerar QR:", e);
      }
      setLinkPagamento(link);
      setQrPagamento(qr);
      await new Promise((r) => setTimeout(r, 80));
    }

    await gerarPDF();
  }

  // Props compartilhadas pelos três templates de PDF (prévia e geração).
  const templateProps = {
    form,
    total,
    plano,
    tenant,
    cor,
    corSuave,
    numero,
    dataHoje,
    dict,
    fmt,
    linkPagamento,
    qrPagamento,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {dict.orc.titulo}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {dict.orc.subtitulo}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Formulário ── */}
        <div className="space-y-5">
          {/* Modelos de orçamento */}
          <section className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
            <div className="min-w-[180px] flex-1">
              <label htmlFor="modelo" className={labelCls}>
                {dict.orc.carregarModelo}
              </label>
              <select
                id="modelo"
                className={inputCls}
                value=""
                onChange={(e) => carregarModelo(e.target.value)}
                disabled={modelos.length === 0}
              >
                <option value="">
                  {modelos.length === 0
                    ? dict.orc.nenhumModelo
                    : dict.orc.selecioneModelo}
                </option>
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={salvarComoModelo}
              disabled={salvandoModelo || total === 0}
              title={dict.orc.salvarModeloTitle}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
            >
              <BookmarkPlus className="size-4" />
              {salvandoModelo ? dict.common.salvando : dict.orc.salvarModelo}
            </button>
          </section>

          {/* Cliente */}
          <section className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {dict.orc.dadosCliente}
            </h3>

            <div>
              <label className={labelCls}>{dict.orc.selecionarCliente}</label>
              <select
                className={inputCls}
                value={form.cliente_id}
                onChange={(e) => selecionarCliente(e.target.value)}
              >
                <option value="">{dict.orc.ouManual}</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="relative">
                <label htmlFor="cli_nome" className={labelCls}>
                  {dict.orc.nome} *
                </label>
                <input
                  id="cli_nome"
                  className={inputCls}
                  value={form.cliente_nome}
                  onChange={(e) => onNomeChange(e.target.value)}
                  onFocus={() => {
                    if (sugestoes.length > 0) setMostrarSugestoes(true);
                  }}
                  onBlur={() =>
                    // Atraso para permitir o clique numa sugestão antes de fechar.
                    setTimeout(() => setMostrarSugestoes(false), 150)
                  }
                  placeholder={dict.orc.nomePlaceholder}
                  autoComplete="off"
                />
                {mostrarSugestoes && sugestoes.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-1 shadow-lg">
                    {sugestoes.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          // onMouseDown dispara antes do onBlur do input.
                          onMouseDown={(e) => {
                            e.preventDefault();
                            aplicarSugestao(c);
                          }}
                          className="flex w-full flex-col items-start px-3 py-2 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {c.nome}
                          </span>
                          {(c.email || c.telefone) && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {[c.email, c.telefone]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <label htmlFor="cli_email" className={labelCls}>
                  {dict.orc.email}
                </label>
                <input
                  id="cli_email"
                  type="email"
                  className={inputCls}
                  value={form.cliente_email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cliente_email: e.target.value }))
                  }
                  placeholder={dict.orc.emailPlaceholder}
                />
              </div>
              <div>
                <label htmlFor="cli_tel" className={labelCls}>
                  {dict.orc.telefone}
                </label>
                <input
                  id="cli_tel"
                  className={inputCls}
                  value={form.cliente_telefone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cliente_telefone: e.target.value }))
                  }
                  placeholder={dict.orc.telefonePlaceholder}
                />
              </div>
              <div>
                <label htmlFor="cli_doc" className={labelCls}>
                  {dict.orc.documento}
                </label>
                <input
                  id="cli_doc"
                  className={inputCls}
                  value={form.cliente_documento}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cliente_documento: e.target.value }))
                  }
                  placeholder={dict.orc.documentoPlaceholder}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="cli_end" className={labelCls}>
                  {dict.orc.endereco}
                </label>
                <input
                  id="cli_end"
                  className={inputCls}
                  value={form.cliente_endereco}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cliente_endereco: e.target.value }))
                  }
                  placeholder={dict.orc.enderecoPlaceholder}
                />
              </div>
            </div>
          </section>

          {/* Serviços */}
          <section className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {dict.orc.servicos}
            </h3>

            {form.servicos.map((s, i) => (
              <div key={s.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <input
                    className={inputCls}
                    placeholder={dict.orc.servicoN(i + 1)}
                    value={s.descricao}
                    onChange={(e) =>
                      updateServico(s.id, "descricao", e.target.value)
                    }
                  />
                </div>
                <div className="w-32">
                  <input
                    className={inputCls}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={dict.orc.valor}
                    value={s.valor}
                    onChange={(e) => updateServico(s.id, "valor", e.target.value)}
                  />
                </div>

                {/* Seletor do catálogo "Meus Serviços" */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setCatalogoAbertoId((atual) =>
                        atual === s.id ? null : s.id,
                      )
                    }
                    title={dict.orc.escolherCatalogo}
                    aria-label={dict.orc.escolherCatalogo}
                    className="mt-1 rounded-lg border border-gray-300 dark:border-gray-700 p-2 text-gray-600 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <ListPlus className="size-4" />
                  </button>

                  {catalogoAbertoId === s.id && (
                    <>
                      {/* Backdrop transparente para fechar ao clicar fora. */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setCatalogoAbertoId(null)}
                      />
                      <ul className="absolute right-0 z-20 mt-1 max-h-64 w-64 overflow-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-1 shadow-lg">
                        {catalogo.length === 0 ? (
                          <li className="px-3 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
                            {dict.orc.nenhumServicoCadastrado}
                            <br />
                            {dict.orc.cadastreEm}
                          </li>
                        ) : (
                          catalogo.map((serv) => (
                            <li key={serv.id}>
                              <button
                                type="button"
                                onClick={() =>
                                  aplicarServicoCatalogo(s.id, serv)
                                }
                                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800"
                              >
                                <span className="truncate text-sm text-gray-900 dark:text-gray-100">
                                  {serv.nome}
                                </span>
                                <span className="shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400">
                                  {fmt(serv.preco)}
                                </span>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    </>
                  )}
                </div>

                {form.servicos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeServico(s.id)}
                    className="mt-1 rounded-lg p-2 text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950"
                    aria-label={dict.serv.remover}
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addServico}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Plus className="size-4" />
              {dict.orc.adicionarServico}
            </button>

            <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-800 pt-3">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {dict.orc.total}
              </span>
              <span className="text-base font-bold" style={{ color: cor }}>
                {fmt(total)}
              </span>
            </div>
          </section>

          {/* Forma de pagamento */}
          <section className="space-y-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {dict.orc.formaPagamento}
            </h3>

            {/* Seletor das 3 opções */}
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  {
                    v: "unico",
                    titulo: dict.orc.pagUnico,
                    desc: dict.orc.pagUnicoDesc,
                  },
                  {
                    v: "entrada_restante",
                    titulo: dict.orc.pagEntrada,
                    desc: dict.orc.pagEntradaDesc,
                  },
                  {
                    v: "parcelado",
                    titulo: dict.orc.pagParcelado,
                    desc: dict.orc.pagParceladoDesc,
                  },
                ] as const
              ).map((opt) => {
                const ativo = form.opcao_pagamento === opt.v;
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => updateForm("opcao_pagamento", opt.v)}
                    className={`rounded-lg border p-3 text-left transition ${
                      ativo
                        ? "border-gray-900 bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-900"
                        : "border-gray-300 dark:border-gray-700 hover:border-gray-400"
                    }`}
                  >
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {opt.titulo}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {opt.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Opção 2 — entrada + restante */}
            {form.opcao_pagamento === "entrada_restante" && (
              <div className="space-y-3 rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
                <div>
                  <label htmlFor="pct_entrada" className={labelCls}>
                    {dict.orc.percentualEntrada}
                  </label>
                  <input
                    id="pct_entrada"
                    className={inputCls}
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={form.percentual_entrada}
                    onChange={(e) =>
                      updateForm("percentual_entrada", e.target.value)
                    }
                  />
                </div>
                {plano.tipo === "entrada_restante" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white dark:bg-gray-900 p-2 text-center">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {dict.orc.entrada} ({plano.pct}%)
                      </div>
                      <div className="font-bold text-gray-900 dark:text-gray-100">
                        {fmt(plano.entrada)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white dark:bg-gray-900 p-2 text-center">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {dict.orc.restante} ({(100 - plano.pct).toFixed(0)}%)
                      </div>
                      <div className="font-bold text-gray-900 dark:text-gray-100">
                        {fmt(plano.restante)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Opção 3 — parcelado */}
            {form.opcao_pagamento === "parcelado" && (
              <div className="space-y-3 rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="parcelas" className={labelCls}>
                      {dict.orc.numParcelas}
                    </label>
                    <select
                      id="parcelas"
                      className={inputCls}
                      value={form.parcelas}
                      onChange={(e) => updateForm("parcelas", e.target.value)}
                    >
                      {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                        <option key={n} value={n}>
                          {n}x
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="tipo_parc" className={labelCls}>
                      {dict.orc.tipoParcelamento}
                    </label>
                    <select
                      id="tipo_parc"
                      className={inputCls}
                      value={form.tipo_parcelamento}
                      onChange={(e) =>
                        updateForm(
                          "tipo_parcelamento",
                          e.target.value as TipoParcelamento,
                        )
                      }
                    >
                      <option value="iguais">{dict.orc.parcelasIguais}</option>
                      <option value="entrada_diferenciada">
                        {dict.orc.entradaDiferenciada}
                      </option>
                    </select>
                  </div>
                </div>

                {form.tipo_parcelamento === "entrada_diferenciada" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="entrada_tipo" className={labelCls}>
                        {dict.orc.entradaEm}
                      </label>
                      <select
                        id="entrada_tipo"
                        className={inputCls}
                        value={form.entrada_tipo}
                        onChange={(e) =>
                          updateForm(
                            "entrada_tipo",
                            e.target.value as TipoEntrada,
                          )
                        }
                      >
                        <option value="percentual">
                          {dict.orc.percentualOpt}
                        </option>
                        <option value="valor">
                          {dict.orc.valorOpt(simbolo)}
                        </option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="entrada_valor" className={labelCls}>
                        {form.entrada_tipo === "percentual"
                          ? dict.orc.pctEntradaLabel
                          : dict.orc.valorEntradaLabel(simbolo)}
                      </label>
                      <input
                        id="entrada_valor"
                        className={inputCls}
                        type="number"
                        min="0"
                        step={form.entrada_tipo === "percentual" ? "1" : "0.01"}
                        value={form.entrada_valor}
                        onChange={(e) =>
                          updateForm("entrada_valor", e.target.value)
                        }
                      />
                    </div>
                  </div>
                )}

                {plano.tipo === "parcelado" && (
                  <div className="rounded-lg bg-white dark:bg-gray-900 p-2">
                    <table className="w-full text-sm">
                      <tbody>
                        {plano.parcelas.map((p) => (
                          <tr
                            key={p.numero}
                            className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                          >
                            <td className="py-1.5 text-gray-600 dark:text-gray-300">
                              {p.entrada
                                ? dict.orc.entrada
                                : dict.orc.parcelaN(p.numero)}
                            </td>
                            <td className="py-1.5 text-right font-semibold text-gray-900 dark:text-gray-100">
                              {fmt(p.valor)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Nota */}
          <section className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {dict.orc.observacoes}
            </h3>
            <div>
              <label htmlFor="nota" className={labelCls}>
                {dict.orc.notaAdicional}
              </label>
              <input
                id="nota"
                className={inputCls}
                value={form.nota}
                onChange={(e) => setForm((f) => ({ ...f, nota: e.target.value }))}
                placeholder={dict.orc.notaPlaceholder}
              />
            </div>
          </section>

          {/* Modelo visual do PDF */}
          <section className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {dict.orc.modeloPdf}
            </h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  {
                    v: "classico",
                    titulo: dict.orc.classico,
                    desc: dict.orc.classicoDesc,
                  },
                  {
                    v: "moderno",
                    titulo: dict.orc.moderno,
                    desc: dict.orc.modernoDesc,
                  },
                  {
                    v: "simples",
                    titulo: dict.orc.simples,
                    desc: dict.orc.simplesDesc,
                  },
                ] as const
              ).map((opt) => {
                const ativo = form.template === opt.v;
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => updateForm("template", opt.v)}
                    className={`rounded-lg border p-3 text-left transition ${
                      ativo
                        ? "border-gray-900 bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-900"
                        : "border-gray-300 dark:border-gray-700 hover:border-gray-400"
                    }`}
                  >
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {opt.titulo}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {opt.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {erro && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </p>
          )}

          {/* Ações */}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-800 lg:hidden"
            >
              <Eye className="size-4" />
              {showPreview ? dict.orc.ocultarPrevia : dict.orc.verPrevia}
            </button>
            <button
              type="button"
              onClick={salvarOrcamento}
              disabled={salvando || !form.cliente_nome || total === 0}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
            >
              {salvo ? <Check className="size-4" /> : <Save className="size-4" />}
              {salvando
                ? dict.common.salvando
                : salvo
                ? dict.common.salvo
                : dict.orc.salvar}
            </button>
            <button
              type="button"
              onClick={salvarEGerar}
              disabled={gerando || salvando || !form.cliente_nome || total === 0}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60"
            >
              <FileDown className="size-4" />
              {gerando ? dict.orc.gerandoPdf : dict.orc.salvarPdf}
            </button>
          </div>
        </div>

        {/* ── Prévia do PDF ── */}
        <div className={showPreview ? "block" : "hidden lg:block"}>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            {dict.orc.previaDoc}
          </p>

          <div
            ref={previewRef}
            style={{
              background: "#ffffff",
              color: "#111111",
              fontFamily: "Helvetica Neue, Arial, sans-serif",
              minHeight: "297mm",
            }}
          >
            {form.template === "moderno" ? (
              <TemplateModerno {...templateProps} />
            ) : form.template === "simples" ? (
              <TemplateSimples {...templateProps} />
            ) : (
              <TemplateClassico {...templateProps} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
