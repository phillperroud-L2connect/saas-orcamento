"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, ArchiveRestore, Trash2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase";

/**
 * Listagem de orçamentos salvos do tenant, com ações de arquivar e deletar.
 *
 * - Arquivar: muda status para 'arquivado' (não apaga). Requer a migração
 *   supabase-orcamentos-arquivar.sql aplicada (adiciona 'arquivado' ao CHECK).
 * - Deletar: remoção permanente, com confirmação. O FK de pagamentos é
 *   ON DELETE CASCADE, então pagamentos vinculados também são removidos.
 * - Orçamentos arquivados ficam ocultos por padrão, em seção separada que
 *   pode ser expandida.
 *
 * RLS já restringe todas as leituras/escritas ao tenant do usuário logado,
 * então as queries não precisam filtrar tenant_id explicitamente.
 */

type OrcamentoStatus =
  | "rascunho"
  | "enviado"
  | "aprovado"
  | "recusado"
  | "arquivado";

type OrcamentoResumo = {
  id: string;
  numero: string | null;
  titulo: string | null;
  total: number;
  moeda: "BRL" | "ARS" | "USD";
  status: OrcamentoStatus;
  created_at: string;
};

const STATUS_LABEL: Record<OrcamentoStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  arquivado: "Arquivado",
};

const STATUS_CLASSE: Record<OrcamentoStatus, string> = {
  rascunho: "bg-gray-100 text-gray-600",
  enviado: "bg-blue-50 text-blue-700",
  aprovado: "bg-green-50 text-green-700",
  recusado: "bg-red-50 text-red-700",
  arquivado: "bg-gray-100 text-gray-500",
};

function formatMoeda(valor: number, moeda: string) {
  const locale =
    moeda === "ARS" ? "es-AR" : moeda === "USD" ? "en-US" : "pt-BR";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: moeda,
    }).format(valor);
  } catch {
    return `${moeda} ${valor.toFixed(2)}`;
  }
}

function formatData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function OrcamentosLista() {
  const [supabase] = useState(() => createClient());
  const [orcamentos, setOrcamentos] = useState<OrcamentoResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  // id do orçamento em processamento (desabilita os botões da linha)
  const [processando, setProcessando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const { data, error } = await supabase
      .from("orcamentos")
      .select("id, numero, titulo, total, moeda, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[OrcamentosLista] erro ao carregar orçamentos:", error);
      setErro("Não foi possível carregar os orçamentos.");
    } else {
      setOrcamentos((data ?? []) as OrcamentoResumo[]);
    }
    setCarregando(false);
  }, [supabase]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function arquivar(id: string) {
    setProcessando(id);
    setErro(null);
    const { error } = await supabase
      .from("orcamentos")
      .update({ status: "arquivado" })
      .eq("id", id);
    if (error) {
      console.error("[OrcamentosLista] erro ao arquivar:", error);
      setErro("Não foi possível arquivar o orçamento.");
    } else {
      setOrcamentos((atuais) =>
        atuais.map((o) =>
          o.id === id ? { ...o, status: "arquivado" as const } : o,
        ),
      );
    }
    setProcessando(null);
  }

  async function desarquivar(id: string) {
    setProcessando(id);
    setErro(null);
    const { error } = await supabase
      .from("orcamentos")
      .update({ status: "rascunho" })
      .eq("id", id);
    if (error) {
      console.error("[OrcamentosLista] erro ao desarquivar:", error);
      setErro("Não foi possível desarquivar o orçamento.");
    } else {
      setOrcamentos((atuais) =>
        atuais.map((o) =>
          o.id === id ? { ...o, status: "rascunho" as const } : o,
        ),
      );
    }
    setProcessando(null);
  }

  async function deletar(id: string, rotulo: string) {
    const ok = window.confirm(
      `Deletar permanentemente o orçamento "${rotulo}"?\n\nEsta ação não pode ser desfeita.`,
    );
    if (!ok) return;
    setProcessando(id);
    setErro(null);
    const { error } = await supabase.from("orcamentos").delete().eq("id", id);
    if (error) {
      console.error("[OrcamentosLista] erro ao deletar:", error);
      setErro("Não foi possível deletar o orçamento.");
    } else {
      setOrcamentos((atuais) => atuais.filter((o) => o.id !== id));
    }
    setProcessando(null);
  }

  const ativos = orcamentos.filter((o) => o.status !== "arquivado");
  const arquivados = orcamentos.filter((o) => o.status === "arquivado");

  function Linha({ o }: { o: OrcamentoResumo }) {
    const ocupado = processando === o.id;
    const rotulo = o.titulo || o.numero || "Orçamento";
    const ehArquivado = o.status === "arquivado";
    return (
      <li className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-gray-50">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-gray-900">
              {rotulo}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASSE[o.status]}`}
            >
              {STATUS_LABEL[o.status]}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-gray-500">
            {o.numero ? `${o.numero} · ` : ""}
            {formatData(o.created_at)} · {formatMoeda(o.total, o.moeda)}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {ehArquivado ? (
            <button
              type="button"
              onClick={() => desarquivar(o.id)}
              disabled={ocupado}
              title="Desarquivar"
              aria-label="Desarquivar orçamento"
              className="rounded-md p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
            >
              <ArchiveRestore className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => arquivar(o.id)}
              disabled={ocupado}
              title="Arquivar"
              aria-label="Arquivar orçamento"
              className="rounded-md p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
            >
              <Archive className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => deletar(o.id, rotulo)}
            disabled={ocupado}
            title="Deletar permanentemente"
            aria-label="Deletar orçamento"
            className="rounded-md p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </li>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 pb-12">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <header className="flex items-center justify-between gap-4 border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Orçamentos salvos
            </h2>
            <p className="text-xs text-gray-500">
              {ativos.length} ativo{ativos.length === 1 ? "" : "s"}
              {arquivados.length > 0
                ? ` · ${arquivados.length} arquivado${arquivados.length === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={carregar}
            disabled={carregando}
            title="Atualizar lista"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${carregando ? "animate-spin" : ""}`}
            />
            Atualizar
          </button>
        </header>

        {erro && (
          <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
            {erro}
          </div>
        )}

        {carregando ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            Carregando…
          </p>
        ) : ativos.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            Nenhum orçamento ativo.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {ativos.map((o) => (
              <Linha key={o.id} o={o} />
            ))}
          </ul>
        )}

        {arquivados.length > 0 && (
          <div className="border-t border-gray-100">
            <button
              type="button"
              onClick={() => setMostrarArquivados((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-xs font-medium text-gray-500 transition hover:bg-gray-50"
            >
              <span>
                {mostrarArquivados ? "Ocultar" : "Mostrar"} arquivados (
                {arquivados.length})
              </span>
              <span className="text-gray-400">
                {mostrarArquivados ? "−" : "+"}
              </span>
            </button>
            {mostrarArquivados && (
              <ul className="divide-y divide-gray-100 bg-gray-50/50">
                {arquivados.map((o) => (
                  <Linha key={o.id} o={o} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
