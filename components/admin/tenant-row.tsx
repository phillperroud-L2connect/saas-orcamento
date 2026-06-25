"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Settings2,
  Check,
  CircleDollarSign,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import type {
  Tenant,
  PlanoContratado,
  StatusAssinatura,
  FormaPagamento,
} from "@/lib/types";

const PAIS_LABEL: Record<string, string> = {
  BR: "🇧🇷 Brasil",
  AR: "🇦🇷 Argentina",
};

const PLANO_LABEL: Record<string, string> = {
  basico: "Básico",
  pro: "Pro",
  manual: "Manual",
};

const FORMA_LABEL: Record<string, string> = {
  mercado_pago: "Mercado Pago",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
};

const STATUS_LABEL: Record<StatusAssinatura, string> = {
  pago: "Pago",
  pendente: "Pendente",
  inadimplente: "Inadimplente",
};

/** Classes do badge colorido por status de assinatura. */
const STATUS_BADGE: Record<StatusAssinatura, { dot: string; chip: string }> = {
  pago: { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700" },
  pendente: { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700" },
  inadimplente: { dot: "bg-red-500", chip: "bg-red-50 text-red-700" },
};

const selectCls =
  "w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900";
const labelCls = "mb-1 block text-xs font-medium text-gray-500";

function formatarData(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(`${d}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
}

/** Vencido = data no passado e ainda não está pago. */
function estaVencido(t: { vencimento: string | null; status_assinatura: StatusAssinatura }) {
  if (!t.vencimento || t.status_assinatura === "pago") return false;
  return new Date(`${t.vencimento}T23:59:59`) < new Date();
}

type Props = {
  tenant: Tenant;
  /** Quantidade de pagamentos no histórico (tabela assinaturas). */
  pagamentos: number;
};

/**
 * Linha da tabela de tenants com painel de gerenciamento de assinatura.
 * As mutações usam o cliente Supabase do browser apoiado na política RLS
 * `tenants_admin_all` (mesmo padrão do TenantForm) — não toca em auth/middleware.
 */
export function TenantRow({ tenant, pagamentos }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState<null | "campos" | "acesso" | "pago">(
    null,
  );
  const [erro, setErro] = useState<string | null>(null);

  // Estado editável (sincronizado com o tenant recebido do servidor).
  const [ativo, setAtivo] = useState(tenant.ativo);
  const [plano, setPlano] = useState<PlanoContratado>(tenant.plano ?? "manual");
  const [status, setStatus] = useState<StatusAssinatura>(
    tenant.status_assinatura ?? "pendente",
  );
  const [forma, setForma] = useState<FormaPagamento>(
    tenant.forma_pagamento ?? "mercado_pago",
  );
  const [vencimento, setVencimento] = useState(tenant.vencimento ?? "");

  const badge = STATUS_BADGE[tenant.status_assinatura ?? "pendente"];
  const vencido = estaVencido(tenant);

  async function persistir(
    patch: Record<string, unknown>,
    tipo: "campos" | "acesso" | "pago",
  ) {
    setErro(null);
    setSalvando(tipo);
    const { error } = await supabase
      .from("tenants")
      .update(patch)
      .eq("id", tenant.id);
    setSalvando(null);
    if (error) {
      setErro(`Erro ao salvar: ${error.message}`);
      return false;
    }
    router.refresh();
    return true;
  }

  // Ativar/desativar acesso — efeito imediato.
  async function toggleAcesso() {
    const novo = !ativo;
    setAtivo(novo);
    const ok = await persistir({ ativo: novo }, "acesso");
    if (!ok) setAtivo(!novo); // rollback visual em caso de erro
  }

  // Salvar plano/status/forma/vencimento.
  async function salvarCampos() {
    await persistir(
      {
        plano,
        status_assinatura: status,
        forma_pagamento: forma,
        vencimento: vencimento || null,
      },
      "campos",
    );
  }

  // Marcar como pago manualmente (dinheiro/transferência) + registra no histórico.
  async function marcarPago() {
    setErro(null);
    setSalvando("pago");

    const formaManual: FormaPagamento =
      forma === "mercado_pago" ? "dinheiro" : forma;
    // Vencimento padrão: +30 dias caso o admin não tenha definido.
    let venc = vencimento;
    if (!venc) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      venc = d.toISOString().slice(0, 10);
    }

    // 1. Registra o pagamento manual no histórico (assinaturas).
    const { error: histErr } = await supabase.from("assinaturas").insert({
      mp_payment_id: `manual:${crypto.randomUUID()}`,
      plano,
      nome: tenant.nome_profissional ?? tenant.nome_empresa,
      email: tenant.email,
      valor: null,
      status: "approved",
      forma_pagamento: formaManual,
      tenant_id: tenant.id,
    });

    if (histErr) {
      setSalvando(null);
      setErro(`Erro ao registrar pagamento: ${histErr.message}`);
      return;
    }

    // 2. Atualiza o tenant para "pago".
    setForma(formaManual);
    setStatus("pago");
    setVencimento(venc);
    const { error } = await supabase
      .from("tenants")
      .update({
        status_assinatura: "pago",
        forma_pagamento: formaManual,
        vencimento: venc,
        plano,
      })
      .eq("id", tenant.id);

    setSalvando(null);
    if (error) {
      setErro(`Erro ao salvar: ${error.message}`);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <tr className="transition hover:bg-gray-50/70">
        {/* Empresa */}
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span
              className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg text-xs font-bold text-white"
              style={{ background: tenant.cor_primaria || "#0F0F0F" }}
            >
              {tenant.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tenant.logo_url} alt="" className="size-full object-cover" />
              ) : (
                tenant.nome_empresa.slice(0, 2).toUpperCase()
              )}
            </span>
            <div>
              <div className="font-medium text-gray-900">{tenant.nome_empresa}</div>
              <div className="text-xs text-gray-400">
                {tenant.email}
                <span className="ml-1.5">{PAIS_LABEL[tenant.pais] ?? tenant.pais}</span>
              </div>
            </div>
          </div>
        </td>

        {/* Plano */}
        <td className="px-5 py-3.5">
          <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            {tenant.plano ? PLANO_LABEL[tenant.plano] : "—"}
          </span>
        </td>

        {/* Status assinatura */}
        <td className="px-5 py-3.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${badge.chip}`}
          >
            <span className={`size-1.5 rounded-full ${badge.dot}`} />
            {STATUS_LABEL[tenant.status_assinatura ?? "pendente"]}
          </span>
        </td>

        {/* Vencimento */}
        <td className="px-5 py-3.5">
          <span className={vencido ? "font-medium text-red-600" : "text-gray-600"}>
            {formatarData(tenant.vencimento)}
          </span>
        </td>

        {/* Forma de pagamento */}
        <td className="px-5 py-3.5 text-gray-600">
          {tenant.forma_pagamento ? FORMA_LABEL[tenant.forma_pagamento] : "—"}
        </td>

        {/* Acesso */}
        <td className="px-5 py-3.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              tenant.ativo ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                tenant.ativo ? "bg-emerald-500" : "bg-gray-400"
              }`}
            />
            {tenant.ativo ? "Ativo" : "Bloqueado"}
          </span>
        </td>

        {/* Ações */}
        <td className="px-5 py-3.5">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                aberto
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Settings2 className="size-3.5" />
              Gerenciar
            </button>
            <Link
              href={`/admin/tenants/${tenant.id}`}
              className="text-sm font-medium text-gray-500 transition hover:text-gray-900"
            >
              Editar
            </Link>
          </div>
        </td>
      </tr>

      {/* Painel de gerenciamento da assinatura */}
      {aberto && (
        <tr className="bg-gray-50/80">
          <td colSpan={7} className="px-5 py-5">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  Assinatura — {tenant.nome_empresa}
                </h3>
                <Link
                  href={`/admin/tenants/${tenant.id}`}
                  className="text-xs font-medium text-gray-500 underline-offset-2 hover:text-gray-900 hover:underline"
                >
                  {pagamentos} pagamento{pagamentos === 1 ? "" : "s"} no histórico →
                </Link>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className={labelCls}>Plano</label>
                  <select
                    className={selectCls}
                    value={plano}
                    onChange={(e) => setPlano(e.target.value as PlanoContratado)}
                  >
                    <option value="basico">Básico</option>
                    <option value="pro">Pro</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select
                    className={selectCls}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as StatusAssinatura)}
                  >
                    <option value="pago">Pago</option>
                    <option value="pendente">Pendente</option>
                    <option value="inadimplente">Inadimplente</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Forma de pagamento</label>
                  <select
                    className={selectCls}
                    value={forma}
                    onChange={(e) => setForma(e.target.value as FormaPagamento)}
                  >
                    <option value="mercado_pago">Mercado Pago</option>
                    <option value="transferencia">Transferência</option>
                    <option value="dinheiro">Dinheiro</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Vencimento</label>
                  <input
                    type="date"
                    className={selectCls}
                    value={vencimento}
                    onChange={(e) => setVencimento(e.target.value)}
                  />
                </div>
              </div>

              {erro && (
                <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {erro}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
                {/* Ativar / desativar acesso */}
                <button
                  type="button"
                  onClick={toggleAcesso}
                  disabled={salvando !== null}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-60 ${
                    ativo
                      ? "border-red-200 text-red-700 hover:bg-red-50"
                      : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  {salvando === "acesso" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : ativo ? (
                    <ShieldOff className="size-4" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}
                  {ativo ? "Desativar acesso" : "Ativar acesso"}
                </button>

                {/* Marcar como pago manualmente */}
                <button
                  type="button"
                  onClick={marcarPago}
                  disabled={salvando !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                >
                  {salvando === "pago" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CircleDollarSign className="size-4" />
                  )}
                  Marcar como pago
                </button>

                {/* Salvar campos */}
                <button
                  type="button"
                  onClick={salvarCampos}
                  disabled={salvando !== null}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60"
                >
                  {salvando === "campos" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Salvar
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
