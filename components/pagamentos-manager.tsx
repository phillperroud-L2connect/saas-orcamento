"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Check,
  Undo2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { fmtMoeda } from "@/lib/moeda";
import type { MoedaPreferida } from "@/lib/types";

/**
 * Aba "Pagamentos" — controle de recebimentos do tenant.
 *
 * Duas fontes, conforme a decisão de produto (pagamentos ligados aos orçamentos
 * + avulsos manuais):
 *
 *  1. PAGAMENTOS DE ORÇAMENTOS — derivados da tabela `orcamentos`. Um orçamento
 *     com status 'aprovado' conta como PAGO; 'enviado' conta como PENDENTE.
 *     Marcar como pago/pendente aqui apenas troca orcamentos.status entre
 *     'aprovado' <-> 'enviado', o que já reflete na aba Financeiro. Não há
 *     tabela nova para isso (fonte única de verdade = o próprio orçamento).
 *
 *  2. PAGAMENTOS AVULSOS — recebimentos digitados à mão, sem orçamento
 *     vinculado. Ficam em public.pagamentos_avulsos (ver
 *     supabase-pagamentos-avulsos.sql). CRUD completo com marcação de pago.
 *
 * RLS restringe tudo ao tenant do usuário logado; nos inserts enviamos
 * tenant_id explicitamente (padrão do resto do app).
 */

type OrcStatus = "rascunho" | "enviado" | "aprovado" | "recusado" | "arquivado";

type OrcamentoRow = {
  id: string;
  numero: string | null;
  titulo: string | null;
  total: number | string;
  moeda: MoedaPreferida;
  status: OrcStatus;
  created_at: string;
  clientes: { nome: string } | null;
};

type AvulsoStatus = "pendente" | "pago";

type AvulsoRow = {
  id: string;
  cliente_id: string | null;
  descricao: string;
  valor: number | string;
  moeda: MoedaPreferida;
  status: AvulsoStatus;
  data_vencimento: string | null;
  data_pagamento: string | null;
  created_at: string;
  clientes: { nome: string } | null;
};

type ClienteOpt = { id: string; nome: string };

const hoje = () => new Date().toISOString().slice(0, 10);

const num = (v: number | string) =>
  typeof v === "string" ? parseFloat(v) || 0 : v || 0;

type FormState = {
  cliente_id: string;
  descricao: string;
  valor: string;
  status: AvulsoStatus;
  data_vencimento: string;
  data_pagamento: string;
};

const formVazio: FormState = {
  cliente_id: "",
  descricao: "",
  valor: "",
  status: "pendente",
  data_vencimento: hoje(),
  data_pagamento: "",
};

export function PagamentosManager() {
  const { dict, data: fmtDataLocal, fmt, moeda } = useI18n();
  const [supabase] = useState(() => createClient());
  const t = dict.pag;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [orcamentos, setOrcamentos] = useState<OrcamentoRow[]>([]);
  const [avulsos, setAvulsos] = useState<AvulsoRow[]>([]);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);

  // Formulário de pagamento avulso (criação/edição inline).
  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(formVazio);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let tId: string | null = null;
    if (user) {
      const { data: userRow } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();
      tId = (userRow?.tenant_id as string | undefined) ?? null;
    }
    setTenantId(tId);

    const [orcRes, avuRes, cliRes] = await Promise.all([
      supabase
        .from("orcamentos")
        .select(
          "id, numero, titulo, total, moeda, status, created_at, clientes(nome)",
        )
        .in("status", ["enviado", "aprovado"])
        .order("created_at", { ascending: false }),
      supabase
        .from("pagamentos_avulsos")
        .select(
          "id, cliente_id, descricao, valor, moeda, status, data_vencimento, data_pagamento, created_at, clientes(nome)",
        )
        .order("created_at", { ascending: false }),
      supabase.from("clientes").select("id, nome").order("nome"),
    ]);

    if (orcRes.error || avuRes.error) {
      console.error("[PagamentosManager] erro ao carregar:", orcRes.error, avuRes.error);
      setErro(t.erroCarregar);
    } else {
      setOrcamentos((orcRes.data as unknown as OrcamentoRow[] | null) ?? []);
      setAvulsos((avuRes.data as unknown as AvulsoRow[] | null) ?? []);
    }
    if (!cliRes.error) setClientes((cliRes.data as ClienteOpt[] | null) ?? []);
    setCarregando(false);
  }, [supabase, t]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // ---- Pagamentos de orçamentos: alterna aprovado (pago) <-> enviado (pendente)
  async function alternarOrcamento(o: OrcamentoRow) {
    const novo: OrcStatus = o.status === "aprovado" ? "enviado" : "aprovado";
    setProcessando(o.id);
    setErro(null);
    const anterior = orcamentos;
    setOrcamentos((atuais) =>
      atuais.map((x) => (x.id === o.id ? { ...x, status: novo } : x)),
    );
    const { error } = await supabase
      .from("orcamentos")
      .update({ status: novo })
      .eq("id", o.id);
    if (error) {
      console.error("[PagamentosManager] erro status orçamento:", error);
      setErro(t.erroStatus);
      setOrcamentos(anterior);
    }
    setProcessando(null);
  }

  // ---- Pagamentos avulsos: form ----
  function abrirNovo() {
    setEditandoId(null);
    setForm(formVazio);
    setFormAberto(true);
  }

  function abrirEdicao(a: AvulsoRow) {
    setEditandoId(a.id);
    setForm({
      cliente_id: a.cliente_id ?? "",
      descricao: a.descricao,
      valor: String(num(a.valor)),
      status: a.status,
      data_vencimento: a.data_vencimento ?? "",
      data_pagamento: a.data_pagamento ?? "",
    });
    setFormAberto(true);
  }

  function fecharForm() {
    setFormAberto(false);
    setEditandoId(null);
    setForm(formVazio);
  }

  async function salvarAvulso(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const descricao = form.descricao.trim();
    if (!descricao) {
      setErro(t.obrigatorioDescricao);
      return;
    }
    const valor = parseFloat(form.valor.replace(",", "."));
    if (isNaN(valor) || valor <= 0) {
      setErro(t.obrigatorioValor);
      return;
    }

    // Se marcou como pago sem data, assume hoje.
    const dataPagamento =
      form.status === "pago" ? form.data_pagamento || hoje() : form.data_pagamento || null;

    const payload = {
      cliente_id: form.cliente_id || null,
      descricao,
      valor,
      moeda,
      status: form.status,
      data_vencimento: form.data_vencimento || null,
      data_pagamento: dataPagamento,
    };

    setSalvando(true);
    if (editandoId) {
      const { error } = await supabase
        .from("pagamentos_avulsos")
        .update(payload)
        .eq("id", editandoId);
      if (error) {
        console.error("[PagamentosManager] erro ao editar avulso:", error);
        setErro(t.erroSalvar);
        setSalvando(false);
        return;
      }
    } else {
      if (!tenantId) {
        setErro(t.erroSalvar);
        setSalvando(false);
        return;
      }
      const { error } = await supabase
        .from("pagamentos_avulsos")
        .insert({ ...payload, tenant_id: tenantId });
      if (error) {
        console.error("[PagamentosManager] erro ao criar avulso:", error);
        setErro(t.erroSalvar);
        setSalvando(false);
        return;
      }
    }
    setSalvando(false);
    fecharForm();
    carregar();
  }

  async function alternarAvulso(a: AvulsoRow) {
    const novo: AvulsoStatus = a.status === "pago" ? "pendente" : "pago";
    setProcessando(a.id);
    setErro(null);
    const anterior = avulsos;
    const dataPagamento = novo === "pago" ? a.data_pagamento ?? hoje() : a.data_pagamento;
    setAvulsos((atuais) =>
      atuais.map((x) =>
        x.id === a.id ? { ...x, status: novo, data_pagamento: dataPagamento } : x,
      ),
    );
    const { error } = await supabase
      .from("pagamentos_avulsos")
      .update({ status: novo, data_pagamento: dataPagamento })
      .eq("id", a.id);
    if (error) {
      console.error("[PagamentosManager] erro status avulso:", error);
      setErro(t.erroStatus);
      setAvulsos(anterior);
    }
    setProcessando(null);
  }

  async function deletarAvulso(a: AvulsoRow) {
    const ok = window.confirm(t.confirmDeletar(a.descricao));
    if (!ok) return;
    setProcessando(a.id);
    setErro(null);
    const { error } = await supabase
      .from("pagamentos_avulsos")
      .delete()
      .eq("id", a.id);
    if (error) {
      console.error("[PagamentosManager] erro ao deletar avulso:", error);
      setErro(t.erroDeletar);
    } else {
      setAvulsos((atuais) => atuais.filter((x) => x.id !== a.id));
    }
    setProcessando(null);
  }

  // ---- Resumo (a receber / recebido / recebido no mês) ----
  const resumo = useMemo(() => {
    const chaveMesAtual = hoje().slice(0, 7); // AAAA-MM

    let aReceber = 0;
    let recebido = 0;
    let recebidoMes = 0;

    for (const o of orcamentos) {
      const v = num(o.total);
      if (o.status === "aprovado") {
        recebido += v;
        if (o.created_at.slice(0, 7) === chaveMesAtual) recebidoMes += v;
      } else {
        aReceber += v;
      }
    }
    for (const a of avulsos) {
      const v = num(a.valor);
      if (a.status === "pago") {
        recebido += v;
        const ref = (a.data_pagamento ?? a.created_at).slice(0, 7);
        if (ref === chaveMesAtual) recebidoMes += v;
      } else {
        aReceber += v;
      }
    }
    return { aReceber, recebido, recebidoMes };
  }, [orcamentos, avulsos]);

  const totalRegistros = orcamentos.length + avulsos.length;

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      {/* Cabeçalho */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {t.titulo}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t.subtitulo}
          </p>
        </div>
        <button
          type="button"
          onClick={carregar}
          disabled={carregando}
          title={dict.lista.atualizar}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${carregando ? "animate-spin" : ""}`} />
          {dict.lista.atualizar}
        </button>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-900 bg-gray-900 p-4 text-white shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-300">
            {t.aReceber}
          </div>
          <div className="mt-2 text-2xl font-bold">{fmt(resumo.aReceber)}</div>
          <div className="mt-1 text-xs text-gray-300">
            {t.totalRegistros(totalRegistros)}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t.recebido}
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {fmt(resumo.recebido)}
          </div>
          <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {t.recebidoMes}: {fmt(resumo.recebidoMes)}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t.recebidoMes}
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {fmt(resumo.recebidoMes)}
          </div>
          <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {t.recebido}: {fmt(resumo.recebido)}
          </div>
        </div>
      </div>

      {erro && (
        <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
          {erro}
        </div>
      )}

      {/* Pagamentos de orçamentos */}
      <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <header className="border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t.deOrcamentos}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {t.deOrcamentosSub}
          </p>
        </header>

        {carregando ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
            {t.carregando}
          </p>
        ) : orcamentos.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
            {t.nenhumOrcamento}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {orcamentos.map((o) => {
              const pago = o.status === "aprovado";
              const ocupado = processando === o.id;
              const nome =
                o.clientes?.nome ??
                o.titulo?.replace(/^(Orçamento|Presupuesto)\s*—\s*/, "") ??
                "—";
              return (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition hover:bg-gray-50 dark:hover:bg-gray-800/60"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        {nome}
                      </span>
                      <StatusBadge pago={pago} labelPago={t.pago} labelPendente={t.pendente} />
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {o.numero ? `${o.numero} · ` : `${t.semNumero} · `}
                      {fmtDataLocal(o.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {fmtMoeda(num(o.total), o.moeda)}
                    </span>
                    <button
                      type="button"
                      onClick={() => alternarOrcamento(o)}
                      disabled={ocupado}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
                        pago
                          ? "border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      {pago ? (
                        <>
                          <Undo2 className="h-3.5 w-3.5" />
                          {t.marcarPendente}
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          {t.marcarPago}
                        </>
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pagamentos avulsos */}
      <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <header className="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t.avulsos}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {t.avulsosSub}
            </p>
          </div>
          {!formAberto && (
            <button
              type="button"
              onClick={abrirNovo}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              <Plus className="h-3.5 w-3.5" />
              {t.novo}
            </button>
          )}
        </header>

        {/* Formulário inline */}
        {formAberto && (
          <form
            onSubmit={salvarAvulso}
            className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30 px-5 py-4"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="sm:col-span-2 lg:col-span-1">
                <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                  {t.descricao}
                </span>
                <input
                  type="text"
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  placeholder={t.descricaoPlaceholder}
                  className={inputCls}
                  autoFocus
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                  {t.clienteOpcional}
                </span>
                <select
                  value={form.cliente_id}
                  onChange={(e) => setForm((f) => ({ ...f, cliente_id: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">{t.semCliente}</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                  {t.valor}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valor}
                  onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                  placeholder="0,00"
                  className={inputCls}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                  {t.status}
                </span>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as AvulsoStatus }))
                  }
                  className={inputCls}
                >
                  <option value="pendente">{t.pendente}</option>
                  <option value="pago">{t.pago}</option>
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                  {t.vencimento}
                </span>
                <input
                  type="date"
                  value={form.data_vencimento}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, data_vencimento: e.target.value }))
                  }
                  className={inputCls}
                />
              </label>
              {form.status === "pago" && (
                <label>
                  <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                    {t.dataPagamento}
                  </span>
                  <input
                    type="date"
                    value={form.data_pagamento}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, data_pagamento: e.target.value }))
                    }
                    className={inputCls}
                  />
                </label>
              )}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="submit"
                disabled={salvando}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
              >
                <Check className="h-4 w-4" />
                {salvando ? t.salvando : t.salvar}
              </button>
              <button
                type="button"
                onClick={fecharForm}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <X className="h-4 w-4" />
                {t.cancelar}
              </button>
            </div>
          </form>
        )}

        {carregando ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
            {t.carregando}
          </p>
        ) : avulsos.length === 0 && !formAberto ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
            {t.nenhumAvulso}
          </p>
        ) : (
          avulsos.length > 0 && (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {avulsos.map((a) => {
                const pago = a.status === "pago";
                const ocupado = processando === a.id;
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {a.descricao}
                        </span>
                        <StatusBadge pago={pago} labelPago={t.pago} labelPendente={t.pendente} />
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {a.clientes?.nome ? `${a.clientes.nome} · ` : ""}
                        {pago && a.data_pagamento
                          ? `${t.pago}: ${fmtDataLocal(a.data_pagamento)}`
                          : a.data_vencimento
                          ? `${t.vencimento}: ${fmtDataLocal(a.data_vencimento)}`
                          : fmtDataLocal(a.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="mr-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {fmtMoeda(num(a.valor), a.moeda)}
                      </span>
                      <button
                        type="button"
                        onClick={() => alternarAvulso(a)}
                        disabled={ocupado}
                        title={pago ? t.marcarPendente : t.marcarPago}
                        aria-label={pago ? t.marcarPendente : t.marcarPago}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
                          pago
                            ? "border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                            : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                      >
                        {pago ? <Undo2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">
                          {pago ? t.marcarPendente : t.marcarPago}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirEdicao(a)}
                        disabled={ocupado}
                        title={t.editar}
                        aria-label={t.editar}
                        className="rounded-md p-2 text-gray-400 dark:text-gray-500 transition hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-40"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deletarAvulso(a)}
                        disabled={ocupado}
                        title={t.deletar}
                        aria-label={t.deletar}
                        className="rounded-md p-2 text-gray-400 dark:text-gray-500 transition hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        )}
      </div>
    </section>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none transition focus:border-gray-900 dark:focus:border-gray-400";

function StatusBadge({
  pago,
  labelPago,
  labelPendente,
}: {
  pago: boolean;
  labelPago: string;
  labelPendente: string;
}) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        pago
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
      }`}
    >
      {pago ? labelPago : labelPendente}
    </span>
  );
}
