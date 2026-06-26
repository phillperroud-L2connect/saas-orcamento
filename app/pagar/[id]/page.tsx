import { createServiceSupabase } from "@/lib/supabase-service";
import { fmtMoeda } from "@/lib/moeda";
import type { Idioma, MoedaPreferida, OrcamentoItem } from "@/lib/types";
import { PagarClient } from "./pagar-client";

export const dynamic = "force-dynamic";

const TEXTOS = {
  pt: {
    de: "Cobrança de",
    resumo: "Resumo do orçamento",
    total: "Total a pagar",
    indisponivel:
      "Este prestador ainda não habilitou pagamentos online. Entre em contato para combinar o pagamento.",
    jaPago: "Este orçamento já foi pago. Obrigado!",
    naoEncontrado: "Orçamento não encontrado.",
    sucesso: "Pagamento aprovado! Obrigado.",
    pendente: "Pagamento pendente de confirmação.",
    falha: "O pagamento não foi concluído. Você pode tentar novamente.",
    seguro: "Pagamento processado com segurança pelo Mercado Pago.",
  },
  es: {
    de: "Cobro de",
    resumo: "Resumen del presupuesto",
    total: "Total a pagar",
    indisponivel:
      "Este proveedor todavía no habilitó pagos online. Contactalo para coordinar el pago.",
    jaPago: "Este presupuesto ya fue pagado. ¡Gracias!",
    naoEncontrado: "Presupuesto no encontrado.",
    sucesso: "¡Pago aprobado! Gracias.",
    pendente: "Pago pendiente de confirmación.",
    falha: "El pago no se completó. Podés intentar de nuevo.",
    seguro: "Pago procesado de forma segura por Mercado Pago.",
  },
} as const;

function Casca({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}

export default async function PagarPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { status?: string };
}) {
  const supabase = createServiceSupabase();

  const { data: orc } = await supabase
    .from("orcamentos")
    .select("id, tenant_id, numero, titulo, itens, total, moeda, status")
    .eq("id", params.id)
    .maybeSingle();

  // Idioma padrão pt até carregar o tenant.
  const idiomaFallback: Idioma = "pt";

  if (!orc) {
    const t = TEXTOS[idiomaFallback];
    return (
      <Casca>
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-600">{t.naoEncontrado}</p>
        </div>
      </Casca>
    );
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("nome_empresa, logo_url, cor_primaria, idioma, mp_access_token")
    .eq("id", orc.tenant_id)
    .maybeSingle();

  const idioma: Idioma = (tenant?.idioma as Idioma) ?? idiomaFallback;
  const t = TEXTOS[idioma];
  const cor = tenant?.cor_primaria || "#0F0F0F";
  const moeda = (orc.moeda as MoedaPreferida) ?? "BRL";
  const itens = (orc.itens as OrcamentoItem[]) ?? [];
  const status = searchParams.status;

  const jaPago = orc.status === "aprovado";
  const semPagamento = !tenant?.mp_access_token;

  return (
    <Casca>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Cabeçalho do prestador */}
        <div
          className="flex items-center gap-3 px-6 py-5 text-white"
          style={{ background: cor }}
        >
          {tenant?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logo_url}
              alt={tenant.nome_empresa ?? ""}
              className="h-10 w-auto rounded bg-white/90 p-1"
            />
          ) : null}
          <div>
            <div className="text-xs uppercase tracking-wide opacity-80">
              {t.de}
            </div>
            <div className="text-lg font-bold">
              {tenant?.nome_empresa ?? "—"}
            </div>
          </div>
        </div>

        <div className="space-y-5 p-6">
          {/* Banner de retorno do pagamento */}
          {status === "success" && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              {t.sucesso}
            </p>
          )}
          {status === "pending" && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {t.pendente}
            </p>
          )}
          {status === "failure" && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {t.falha}
            </p>
          )}

          {/* Resumo */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">{t.resumo}</h2>
              {orc.numero ? (
                <span className="text-xs text-gray-400">{orc.numero}</span>
              ) : null}
            </div>
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {itens
                .filter((i) => i.descricao || i.valor)
                .map((i, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span className="text-gray-700">{i.descricao || "—"}</span>
                    <span className="font-medium text-gray-900">
                      {fmtMoeda(Number(i.valor) || 0, moeda)}
                    </span>
                  </li>
                ))}
            </ul>
          </div>

          {/* Total */}
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3 text-white"
            style={{ background: cor }}
          >
            <span className="text-sm font-medium uppercase tracking-wide">
              {t.total}
            </span>
            <span className="text-2xl font-extrabold">
              {fmtMoeda(Number(orc.total) || 0, moeda)}
            </span>
          </div>

          {/* Ação */}
          {jaPago ? (
            <p className="rounded-lg bg-green-50 px-3 py-3 text-center text-sm font-medium text-green-700">
              {t.jaPago}
            </p>
          ) : semPagamento ? (
            <p className="rounded-lg bg-gray-50 px-3 py-3 text-center text-sm text-gray-600">
              {t.indisponivel}
            </p>
          ) : (
            <PagarClient orcamentoId={orc.id} idioma={idioma} cor={cor} />
          )}

          <p className="text-center text-xs text-gray-400">{t.seguro}</p>
        </div>
      </div>
    </Casca>
  );
}
