import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase-server";
import { getDict } from "@/lib/i18n";
import { fmtData, fmtMoeda, moedaDoTenant } from "@/lib/moeda";
import type { Idioma, MoedaPreferida } from "@/lib/types";
import {
  chaveMes,
  chavesDoPeriodo,
  chavesPeriodoAnterior,
  mesesDoPeriodo,
  normalizarPeriodo,
} from "@/lib/periodo";
import { PeriodoSelectNav } from "@/components/periodo-selector";
import {
  FaturamentoChart,
  type PontoFaturamento,
} from "@/components/faturamento-chart";

export const metadata = {
  title: "Financeiro | Gerador de Orçamento",
};

// Sempre buscar dados frescos do Supabase a cada acesso.
export const dynamic = "force-dynamic";

type OrcamentoRow = {
  id: string;
  numero: string | null;
  titulo: string | null;
  total: number | string;
  status: "rascunho" | "enviado" | "aprovado" | "recusado" | "arquivado";
  created_at: string;
  cliente_id: string | null;
  clientes: { nome: string } | null;
};

const STATUS_CLS: Record<OrcamentoRow["status"], string> = {
  rascunho: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300",
  enviado: "bg-blue-50 text-blue-700",
  aprovado: "bg-green-50 text-green-700",
  recusado: "bg-red-50 text-red-700",
  arquivado: "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
};

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams?: { periodo?: string };
}) {
  const periodo = normalizarPeriodo(searchParams?.periodo);
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Resolve o tenant do usuário logado para filtrar explicitamente.
  let tenantId: string | null = null;
  let idioma: Idioma = "pt";
  let moeda: MoedaPreferida = "BRL";
  if (user) {
    const { data: userRow } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    tenantId = (userRow?.tenant_id as string | undefined) ?? null;

    if (tenantId) {
      const { data: tenantRow } = await supabase
        .from("tenants")
        .select("idioma, moeda_preferida")
        .eq("id", tenantId)
        .single();
      if (tenantRow) {
        idioma = (tenantRow.idioma as Idioma) ?? "pt";
        moeda = moedaDoTenant(
          tenantRow as { idioma: Idioma; moeda_preferida: MoedaPreferida | null },
        );
      }
    }
  }

  const dict = getDict(idioma);
  const fmt = (v: number) => fmtMoeda(v, moeda);
  const STATUS_STYLE: Record<
    OrcamentoRow["status"],
    { label: string; cls: string }
  > = {
    rascunho: { label: dict.lista.status.rascunho, cls: STATUS_CLS.rascunho },
    enviado: { label: dict.lista.status.enviado, cls: STATUS_CLS.enviado },
    aprovado: { label: dict.lista.status.aprovado, cls: STATUS_CLS.aprovado },
    recusado: { label: dict.lista.status.recusado, cls: STATUS_CLS.recusado },
    arquivado: { label: dict.lista.status.arquivado, cls: STATUS_CLS.arquivado },
  };

  // Carrega os orçamentos do tenant (RLS já restringe; o filtro é redundante e explícito).
  let orcamentos: OrcamentoRow[] = [];
  if (tenantId) {
    const { data } = await supabase
      .from("orcamentos")
      .select(
        "id, numero, titulo, total, status, created_at, cliente_id, clientes(nome)",
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    orcamentos = (data as OrcamentoRow[] | null) ?? [];
  }

  const num = (v: number | string) =>
    typeof v === "string" ? parseFloat(v) || 0 : v || 0;

  // "Faturado" = soma dos orçamentos aprovados (receita realizada).
  const aprovadosArr = orcamentos.filter((o) => o.status === "aprovado");
  const recusadosArr = orcamentos.filter((o) => o.status === "recusado");

  // Agregações da janela selecionada. A fonte de dados é sempre a mesma (todos
  // os orçamentos do tenant); o período apenas decide quais meses entram.
  const agora = new Date();
  let faturadoPeriodoAtual = 0;
  let faturadoPeriodoAnterior = 0;
  let aprovadosPeriodo: OrcamentoRow[] = [];
  let recusadosPeriodo: OrcamentoRow[] = [];
  let serie: PontoFaturamento[] = [];

  try {
    const chavesAtual = chavesDoPeriodo(periodo, agora);
    const chavesAnterior = chavesPeriodoAnterior(periodo, agora);
    const noPeriodo = (o: OrcamentoRow, chaves: Set<string>) =>
      chaves.has(chaveMes(new Date(o.created_at)));

    aprovadosPeriodo = aprovadosArr.filter((o) => noPeriodo(o, chavesAtual));
    recusadosPeriodo = recusadosArr.filter((o) => noPeriodo(o, chavesAtual));

    faturadoPeriodoAtual = aprovadosPeriodo.reduce((s, o) => s + num(o.total), 0);
    faturadoPeriodoAnterior = aprovadosArr
      .filter((o) => noPeriodo(o, chavesAnterior))
      .reduce((s, o) => s + num(o.total), 0);

    // Série de barras: um ponto por mês do período (do mais antigo ao atual).
    serie = mesesDoPeriodo(periodo, agora).map((m) => ({
      mes: `${dict.fin.meses[m.mes]}/${String(m.ano).slice(2)}`,
      total: aprovadosArr
        .filter((o) => chaveMes(new Date(o.created_at)) === m.chave)
        .reduce((s, o) => s + num(o.total), 0),
    }));
  } catch (e) {
    console.error("[FinanceiroPage] falha ao agregar período:", e);
    // Fallback seguro: mantém a tela funcional mesmo se o cálculo falhar.
    aprovadosPeriodo = aprovadosArr;
    recusadosPeriodo = recusadosArr;
    faturadoPeriodoAtual = aprovadosArr.reduce((s, o) => s + num(o.total), 0);
    serie = [];
  }

  const totalAprovadoPeriodo = faturadoPeriodoAtual;
  const ticketMedio =
    aprovadosPeriodo.length > 0
      ? totalAprovadoPeriodo / aprovadosPeriodo.length
      : 0;

  // Variação percentual: período atual vs período anterior de mesmo tamanho.
  const variacao =
    faturadoPeriodoAnterior > 0
      ? ((faturadoPeriodoAtual - faturadoPeriodoAnterior) /
          faturadoPeriodoAnterior) *
        100
      : null;

  const ehMes = periodo === "mes";

  const ultimos = orcamentos.slice(0, 10);

  const cards = [
    {
      titulo: ehMes ? dict.fin.faturadoMes : dict.fin.faturadoPeriodo,
      valor: fmt(faturadoPeriodoAtual),
      sub:
        variacao === null
          ? ehMes
            ? dict.fin.semBase
            : dict.fin.semBasePeriodo
          : (ehMes ? dict.fin.vsMesAnterior : dict.fin.vsPeriodoAnterior)(
              Number(Math.abs(variacao).toFixed(0)),
              variacao >= 0,
            ),
      subCls:
        variacao === null
          ? "text-gray-400 dark:text-gray-500"
          : variacao >= 0
          ? "text-green-600"
          : "text-red-600",
      destaque: true,
    },
    {
      titulo: ehMes ? dict.fin.mesAnterior : dict.fin.periodoAnterior,
      valor: fmt(faturadoPeriodoAnterior),
      sub: dict.fin.faturamentoAprovado,
      subCls: "text-gray-400 dark:text-gray-500",
      destaque: false,
    },
    {
      titulo: dict.fin.ticketMedio,
      valor: fmt(ticketMedio),
      sub: dict.fin.orcAprovados(aprovadosPeriodo.length),
      subCls: "text-gray-400 dark:text-gray-500",
      destaque: false,
    },
    {
      titulo: dict.fin.aprovadosVsRecusados,
      valor: `${aprovadosPeriodo.length} / ${recusadosPeriodo.length}`,
      sub: dict.fin.aprovadosRecusadosSub,
      subCls: "text-gray-400 dark:text-gray-500",
      destaque: false,
    },
  ];

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Cabeçalho */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {dict.fin.titulo}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {dict.fin.subtitulo}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PeriodoSelectNav
              value={periodo}
              label={dict.common.periodo.label}
              opcoes={dict.common.periodo.opcoes}
            />
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="size-4" />
              {dict.common.voltar}
            </Link>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div
              key={c.titulo}
              className={`rounded-xl border p-4 shadow-sm ${
                c.destaque
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
              }`}
            >
              <div
                className={`text-xs font-medium uppercase tracking-wide ${
                  c.destaque ? "text-gray-300" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {c.titulo}
              </div>
              <div
                className={`mt-2 text-2xl font-bold ${
                  c.destaque ? "text-white" : "text-gray-900 dark:text-gray-100"
                }`}
              >
                {c.valor}
              </div>
              <div className={`mt-1 text-xs ${c.destaque ? "text-gray-300" : c.subCls}`}>
                {c.sub}
              </div>
            </div>
          ))}
        </div>

        {/* Gráfico */}
        <section className="mt-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {`${dict.fin.faturamento} — ${dict.common.periodo.opcoes[periodo]}`}
            </h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {dict.fin.orcAprovadosLabel}
            </span>
          </div>
          <FaturamentoChart
            dados={serie}
            moeda={moeda}
            labelFaturado={dict.fin.faturado}
            labelVazio={dict.fin.semFaturamentoPeriodo}
          />
        </section>

        {/* Últimos orçamentos */}
        <section className="mt-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="border-b border-gray-100 dark:border-gray-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {dict.fin.ultimos}
            </h2>
          </div>

          {ultimos.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
              {dict.fin.nenhum}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    <th className="px-5 py-3 font-medium">{dict.fin.numero}</th>
                    <th className="px-5 py-3 font-medium">{dict.fin.cliente}</th>
                    <th className="px-5 py-3 font-medium">{dict.fin.status}</th>
                    <th className="px-5 py-3 font-medium">{dict.fin.data}</th>
                    <th className="px-5 py-3 text-right font-medium">
                      {dict.fin.valor}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ultimos.map((o) => {
                    const st = STATUS_STYLE[o.status] ?? {
                      label: o.status ?? "—",
                      cls: STATUS_CLS.rascunho,
                    };
                    const cliente =
                      o.clientes?.nome ??
                      o.titulo?.replace(/^(Orçamento|Presupuesto)\s*—\s*/, "") ??
                      "—";
                    return (
                      <tr
                        key={o.id}
                        className="border-t border-gray-50 transition hover:bg-gray-50/60 dark:border-gray-800 dark:hover:bg-gray-800/60"
                      >
                        <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                          {o.numero ?? "—"}
                        </td>
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                          {cliente}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                          {fmtData(o.created_at, idioma)}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                          {fmt(num(o.total))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
