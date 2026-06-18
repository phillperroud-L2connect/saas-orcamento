"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, FileDown, Eye, Save, Check } from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { Cliente, Tenant, OrcamentoItem } from "@/lib/types";

type ServicoItem = {
  id: string;
  descricao: string;
  valor: string;
};

type OpcaoPagamento = "unico" | "entrada_restante" | "parcelado";
type TipoParcelamento = "iguais" | "entrada_diferenciada";
type TipoEntrada = "percentual" | "valor";

type FormState = {
  cliente_id: string;
  cliente_nome: string;
  cliente_email: string;
  cliente_telefone: string;
  servicos: ServicoItem[];
  nota: string;
  // ── Pagamento ──
  opcao_pagamento: OpcaoPagamento;
  percentual_entrada: string; // Opção 2 (entrada + restante)
  parcelas: string; // Opção 3 (2 a 12)
  tipo_parcelamento: TipoParcelamento; // Opção 3
  entrada_tipo: TipoEntrada; // Opção 3 — entrada diferenciada
  entrada_valor: string; // Opção 3 — valor ou % da entrada diferenciada
};

const emptyForm: FormState = {
  cliente_id: "",
  cliente_nome: "",
  cliente_email: "",
  cliente_telefone: "",
  servicos: [{ id: "1", descricao: "", valor: "" }],
  nota: "",
  opcao_pagamento: "unico",
  percentual_entrada: "50",
  parcelas: "2",
  tipo_parcelamento: "iguais",
  entrada_tipo: "percentual",
  entrada_valor: "30",
};

/** Plano de pagamento calculado a partir do total e das escolhas do formulário. */
type PlanoPagamento =
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

/** Rótulos fixos em português — sem opção de troca de idioma. */
const t = {
  titulo: "Orçamento",
  data: "Data",
  numero: "Nº",
  cliente: "Cliente",
  email: "E-mail",
  telefone: "Telefone",
  servicos: "Serviços",
  servico: "Serviço / Descrição",
  valor: "Valor",
  total: "Total",
  pagamento: "Condições de Pagamento",
  validade: "Validade",
  validade_val: "30 dias",
  rodape: "Obrigado pela preferência!",
};

function gerarNumero() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `ORC-${yy}${mm}-${seq}`;
}

function formatDataBR(d: Date) {
  return d.toLocaleDateString("pt-BR");
}

/** Moeda fixa em BRL. */
function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Converte o total + escolhas de pagamento em um plano estruturado.
 * Usado tanto na prévia/PDF quanto na hora de salvar no banco.
 */
function calcularPlano(total: number, form: FormState): PlanoPagamento {
  if (form.opcao_pagamento === "entrada_restante") {
    const pct = clamp(parseFloat(form.percentual_entrada) || 0, 0, 100);
    const entrada = (total * pct) / 100;
    const restante = total - entrada;
    return {
      tipo: "entrada_restante",
      pct,
      entrada,
      restante,
      resumo: `Entrada de ${pct}% (${fmtBRL(entrada)}) + restante de ${fmtBRL(
        restante,
      )} — 2 pagamentos separados.`,
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
        resumo: `Entrada de ${fmtBRL(entrada)} + ${nRest}x de ${fmtBRL(
          valorRest,
        )}.`,
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
      resumo: `${n}x de ${fmtBRL(valor)} (parcelas iguais).`,
    };
  }

  return {
    tipo: "unico",
    resumo: `Pagamento à vista — ${fmtBRL(total)}.`,
  };
}

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900";
const labelCls = "block text-sm font-medium text-gray-700 mb-1";

export function OrcamentosManager() {
  const supabase = createClient();
  const previewRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [showPreview, setShowPreview] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [numero, setNumero] = useState("");
  const [dataHoje, setDataHoje] = useState("");

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
  }, [supabase]);

  useEffect(() => {
    carregarContexto();
    setNumero(gerarNumero());
    setDataHoje(formatDataBR(new Date()));
  }, [carregarContexto]);

  function selecionarCliente(id: string) {
    const c = clientes.find((c) => c.id === id);
    setForm((f) => ({
      ...f,
      cliente_id: id,
      cliente_nome: c?.nome ?? "",
      cliente_email: c?.email ?? "",
      cliente_telefone: c?.telefone ?? "",
    }));
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

  const total = form.servicos.reduce(
    (sum, s) => sum + (parseFloat(s.valor) || 0),
    0,
  );
  const plano = calcularPlano(total, form);

  // Cor de destaque do orçamento: cor primária do tenant ou fallback escuro.
  const cor = tenant?.cor_primaria || "#0F0F0F";
  const corSuave = `${cor}14`; // ~8% de opacidade (hex alpha)

  async function salvarOrcamento(): Promise<string | null> {
    if (!tenantId) {
      setErro("Não foi possível identificar seu tenant. Refaça o login.");
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
          ? `Orçamento — ${form.cliente_nome}`
          : "Orçamento",
        itens,
        subtotal: total,
        desconto: 0,
        total,
        moeda: "BRL",
        status: "rascunho",
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
      setErro(`Erro ao salvar: ${error.message}`);
      return null;
    }

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
      pdf.save(`orcamento-${form.cliente_nome || "cliente"}-${numero}.pdf`);
    } catch (e) {
      console.error(e);
    }
    setGerando(false);
  }

  async function salvarEGerar() {
    await salvarOrcamento();
    await gerarPDF();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Orçamentos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gere orçamentos profissionais em PDF e salve no histórico.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Formulário ── */}
        <div className="space-y-5">
          {/* Cliente */}
          <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">
              Dados do Cliente
            </h3>

            <div>
              <label className={labelCls}>Selecionar cliente cadastrado</label>
              <select
                className={inputCls}
                value={form.cliente_id}
                onChange={(e) => selecionarCliente(e.target.value)}
              >
                <option value="">— ou preencha manualmente —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="cli_nome" className={labelCls}>
                  Nome *
                </label>
                <input
                  id="cli_nome"
                  className={inputCls}
                  value={form.cliente_nome}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cliente_nome: e.target.value }))
                  }
                  placeholder="Nome do cliente"
                />
              </div>
              <div>
                <label htmlFor="cli_email" className={labelCls}>
                  E-mail
                </label>
                <input
                  id="cli_email"
                  type="email"
                  className={inputCls}
                  value={form.cliente_email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cliente_email: e.target.value }))
                  }
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="cli_tel" className={labelCls}>
                  Telefone
                </label>
                <input
                  id="cli_tel"
                  className={inputCls}
                  value={form.cliente_telefone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cliente_telefone: e.target.value }))
                  }
                  placeholder="+55 11 99999-9999"
                />
              </div>
            </div>
          </section>

          {/* Serviços */}
          <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Serviços</h3>

            {form.servicos.map((s, i) => (
              <div key={s.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <input
                    className={inputCls}
                    placeholder={`Serviço ${i + 1}`}
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
                    placeholder="Valor"
                    value={s.valor}
                    onChange={(e) => updateServico(s.id, "valor", e.target.value)}
                  />
                </div>
                {form.servicos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeServico(s.id)}
                    className="mt-1 rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                    aria-label="Remover serviço"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addServico}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <Plus className="size-4" />
              Adicionar serviço
            </button>

            <div className="flex items-center justify-between border-t border-gray-200 pt-3">
              <span className="text-sm font-semibold text-gray-900">Total</span>
              <span className="text-base font-bold" style={{ color: cor }}>
                {fmtBRL(total)}
              </span>
            </div>
          </section>

          {/* Forma de pagamento */}
          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">
              Forma de Pagamento
            </h3>

            {/* Seletor das 3 opções */}
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  {
                    v: "unico",
                    titulo: "Pagamento único",
                    desc: "À vista, valor total",
                  },
                  {
                    v: "entrada_restante",
                    titulo: "Entrada + restante",
                    desc: "Dois pagamentos",
                  },
                  { v: "parcelado", titulo: "Parcelado", desc: "De 2x a 12x" },
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
                        ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <div className="text-sm font-semibold text-gray-900">
                      {opt.titulo}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">{opt.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Opção 2 — entrada + restante */}
            {form.opcao_pagamento === "entrada_restante" && (
              <div className="space-y-3 rounded-lg bg-gray-50 p-3">
                <div>
                  <label htmlFor="pct_entrada" className={labelCls}>
                    Percentual de entrada (%)
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
                    <div className="rounded-lg bg-white p-2 text-center">
                      <div className="text-xs text-gray-500">
                        Entrada ({plano.pct}%)
                      </div>
                      <div className="font-bold text-gray-900">
                        {fmtBRL(plano.entrada)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white p-2 text-center">
                      <div className="text-xs text-gray-500">
                        Restante ({(100 - plano.pct).toFixed(0)}%)
                      </div>
                      <div className="font-bold text-gray-900">
                        {fmtBRL(plano.restante)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Opção 3 — parcelado */}
            {form.opcao_pagamento === "parcelado" && (
              <div className="space-y-3 rounded-lg bg-gray-50 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="parcelas" className={labelCls}>
                      Número de parcelas
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
                      Tipo de parcelamento
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
                      <option value="iguais">Parcelas iguais</option>
                      <option value="entrada_diferenciada">
                        Entrada diferenciada
                      </option>
                    </select>
                  </div>
                </div>

                {form.tipo_parcelamento === "entrada_diferenciada" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="entrada_tipo" className={labelCls}>
                        Entrada em
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
                        <option value="percentual">Percentual (%)</option>
                        <option value="valor">Valor (R$)</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="entrada_valor" className={labelCls}>
                        {form.entrada_tipo === "percentual"
                          ? "% da entrada"
                          : "Valor da entrada (R$)"}
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
                  <div className="rounded-lg bg-white p-2">
                    <table className="w-full text-sm">
                      <tbody>
                        {plano.parcelas.map((p) => (
                          <tr
                            key={p.numero}
                            className="border-b border-gray-100 last:border-0"
                          >
                            <td className="py-1.5 text-gray-600">
                              {p.entrada ? "Entrada" : `Parcela ${p.numero}`}
                            </td>
                            <td className="py-1.5 text-right font-semibold text-gray-900">
                              {fmtBRL(p.valor)}
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
          <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Observações</h3>
            <div>
              <label htmlFor="nota" className={labelCls}>
                Nota adicional
              </label>
              <input
                id="nota"
                className={inputCls}
                value={form.nota}
                onChange={(e) => setForm((f) => ({ ...f, nota: e.target.value }))}
                placeholder="Observações, prazo de entrega..."
              />
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
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 lg:hidden"
            >
              <Eye className="size-4" />
              {showPreview ? "Ocultar prévia" : "Ver prévia"}
            </button>
            <button
              type="button"
              onClick={salvarOrcamento}
              disabled={salvando || !form.cliente_nome || total === 0}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
            >
              {salvo ? <Check className="size-4" /> : <Save className="size-4" />}
              {salvando ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
            </button>
            <button
              type="button"
              onClick={salvarEGerar}
              disabled={gerando || salvando || !form.cliente_nome || total === 0}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60"
            >
              <FileDown className="size-4" />
              {gerando ? "Gerando PDF..." : "Salvar + PDF"}
            </button>
          </div>
        </div>

        {/* ── Prévia do PDF ── */}
        <div className={showPreview ? "block" : "hidden lg:block"}>
          <p className="mb-2 text-xs text-gray-500">
            Prévia do documento — o PDF terá aparência idêntica.
          </p>

          <div
            ref={previewRef}
            style={{
              background: "#ffffff",
              color: "#111111",
              fontFamily: "Helvetica Neue, Arial, sans-serif",
              padding: "40px",
              minHeight: "297mm",
              fontSize: "13px",
              lineHeight: "1.5",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "32px",
                paddingBottom: "24px",
                borderBottom: `2px solid ${cor}`,
              }}
            >
              <div>
                {tenant?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tenant.logo_url}
                    alt={tenant.nome_empresa}
                    style={{ height: "56px", width: "auto", display: "block" }}
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div
                    style={{
                      fontSize: "22px",
                      fontWeight: 800,
                      color: cor,
                      letterSpacing: "0.5px",
                    }}
                  >
                    {tenant?.nome_empresa || "Sua Empresa"}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "#111",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                  }}
                >
                  {t.titulo}
                </div>
                <div style={{ color: "#666", fontSize: "12px", marginTop: "4px" }}>
                  {t.numero} {numero}
                </div>
                <div style={{ color: "#666", fontSize: "12px" }}>
                  {t.data}: {dataHoje}
                </div>
                <div style={{ color: "#666", fontSize: "12px" }}>
                  {t.validade}: {t.validade_val}
                </div>
              </div>
            </div>

            {/* Cliente */}
            <div
              style={{
                marginBottom: "28px",
                background: corSuave,
                borderRadius: "8px",
                padding: "16px",
                borderLeft: `4px solid ${cor}`,
              }}
            >
              <div style={{ fontWeight: 700, color: cor, marginBottom: "8px" }}>
                {t.cliente}
              </div>
              <div style={{ fontWeight: 600 }}>
                {form.cliente_nome || "Nome do Cliente"}
              </div>
              {form.cliente_email && (
                <div style={{ color: "#555" }}>{form.cliente_email}</div>
              )}
              {form.cliente_telefone && (
                <div style={{ color: "#555" }}>{form.cliente_telefone}</div>
              )}
            </div>

            {/* Serviços */}
            <div style={{ marginBottom: "28px" }}>
              <div
                style={{
                  fontWeight: 700,
                  color: cor,
                  marginBottom: "12px",
                  textTransform: "uppercase",
                  fontSize: "11px",
                  letterSpacing: "1px",
                }}
              >
                {t.servicos}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: cor, color: "#fff" }}>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        fontWeight: 600,
                        fontSize: "12px",
                      }}
                    >
                      {t.servico}
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        fontWeight: 600,
                        fontSize: "12px",
                        width: "140px",
                      }}
                    >
                      {t.valor}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {form.servicos
                    .filter((s) => s.descricao || s.valor)
                    .map((s, i) => (
                      <tr
                        key={s.id}
                        style={{ background: i % 2 === 0 ? "#fff" : corSuave }}
                      >
                        <td
                          style={{
                            padding: "10px 12px",
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          {s.descricao || `Serviço ${i + 1}`}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            textAlign: "right",
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          {fmtBRL(parseFloat(s.valor) || 0)}
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: corSuave }}>
                    <td
                      style={{ padding: "12px", fontWeight: 700, fontSize: "14px" }}
                    >
                      {t.total}
                    </td>
                    <td
                      style={{
                        padding: "12px",
                        textAlign: "right",
                        fontWeight: 800,
                        fontSize: "16px",
                        color: cor,
                      }}
                    >
                      {fmtBRL(total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Condições de pagamento */}
            <div
              style={{
                marginBottom: "24px",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  background: corSuave,
                  padding: "10px 16px",
                  fontWeight: 700,
                  color: cor,
                  fontSize: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {t.pagamento}
              </div>
              <div style={{ padding: "16px" }}>
                {/* Opção 1 — pagamento único */}
                {plano.tipo === "unico" && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: "13px", color: "#555" }}>
                      Pagamento à vista
                    </span>
                    <span
                      style={{ fontSize: "22px", fontWeight: 800, color: cor }}
                    >
                      {fmtBRL(total)}
                    </span>
                  </div>
                )}

                {/* Opção 2 — entrada + restante */}
                {plano.tipo === "entrada_restante" && (
                  <>
                    <div style={{ display: "flex", gap: "16px" }}>
                      <div
                        style={{
                          flex: 1,
                          textAlign: "center",
                          background: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          padding: "16px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#666",
                            marginBottom: "4px",
                          }}
                        >
                          Entrada ({plano.pct}%)
                        </div>
                        <div
                          style={{ fontSize: "20px", fontWeight: 800, color: cor }}
                        >
                          {fmtBRL(plano.entrada)}
                        </div>
                      </div>
                      <div
                        style={{
                          flex: 1,
                          textAlign: "center",
                          background: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          padding: "16px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#666",
                            marginBottom: "4px",
                          }}
                        >
                          Restante ({(100 - plano.pct).toFixed(0)}%)
                        </div>
                        <div
                          style={{ fontSize: "20px", fontWeight: 800, color: cor }}
                        >
                          {fmtBRL(plano.restante)}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: "12px",
                        fontSize: "11px",
                        color: "#888",
                        textAlign: "center",
                      }}
                    >
                      * São 2 pagamentos separados: entrada e restante na entrega.
                    </div>
                  </>
                )}

                {/* Opção 3 — parcelado */}
                {plano.tipo === "parcelado" && (
                  <>
                    <div
                      style={{
                        marginBottom: "10px",
                        fontSize: "12px",
                        color: "#555",
                      }}
                    >
                      {plano.subtipo === "entrada_diferenciada"
                        ? `Parcelado em ${plano.n}x com entrada diferenciada`
                        : `Parcelado em ${plano.n}x iguais`}
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <tbody>
                        {plano.parcelas.map((p) => (
                          <tr key={p.numero}>
                            <td
                              style={{
                                padding: "8px 12px",
                                borderBottom: "1px solid #eee",
                                fontSize: "12px",
                                color: "#444",
                              }}
                            >
                              {p.entrada
                                ? "Entrada (1ª parcela)"
                                : `Parcela ${p.numero}`}
                            </td>
                            <td
                              style={{
                                padding: "8px 12px",
                                borderBottom: "1px solid #eee",
                                textAlign: "right",
                                fontWeight: 700,
                                color: cor,
                                fontSize: "13px",
                              }}
                            >
                              {fmtBRL(p.valor)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>

            {/* Nota adicional */}
            {form.nota && (
              <div
                style={{
                  marginBottom: "24px",
                  padding: "12px 16px",
                  background: "#fffbf0",
                  border: "1px solid #ffe080",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#555",
                }}
              >
                {form.nota}
              </div>
            )}

            {/* Rodapé */}
            <div
              style={{
                marginTop: "40px",
                textAlign: "center",
                borderTop: "1px solid #eee",
                paddingTop: "16px",
              }}
            >
              <div style={{ color: "#888", fontSize: "12px" }}>{t.rodape}</div>
              {tenant && (
                <div
                  style={{
                    marginTop: "6px",
                    color: "#aaa",
                    fontSize: "10px",
                    letterSpacing: "0.3px",
                  }}
                >
                  {[tenant.nome_empresa, tenant.email, tenant.telefone]
                    .filter(Boolean)
                    .join(" | ")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
