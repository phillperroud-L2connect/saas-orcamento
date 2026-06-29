import { NextResponse } from "next/server";
import { Preference } from "mercadopago";
import { getMercadoPagoClientFor, getSiteUrl } from "@/lib/mercadopago";
import { createServiceSupabase } from "@/lib/supabase-service";
import {
  aplicarRateLimit,
  limiterPagamento,
  getClientIp,
  tooManyRequests,
} from "@/lib/rate-limit";

/**
 * POST /api/mp/pagar-orcamento
 *
 * Cria uma preferência de pagamento para um orçamento, usando o access_token da
 * conta Mercado Pago do PRESTADOR dono do orçamento — assim o dinheiro cai na
 * conta dele, não na do dono do SaaS.
 *
 * Rota pública (prefixo /api/mp): chamada pela página pública /pagar/[id] sem
 * sessão. Lê orçamento e tenant via service role (RLS não se aplica a páginas
 * públicas de pagamento).
 */
export async function POST(req: Request) {
  // Rate limit: cria preferência de pagamento no MP — limita abuso por IP.
  const rl = await aplicarRateLimit(limiterPagamento, `pagar:${getClientIp(req)}`);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  let body: { orcamentoId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const orcamentoId = body.orcamentoId?.trim();
  if (!orcamentoId) {
    return NextResponse.json({ erro: "orcamentoId ausente." }, { status: 400 });
  }

  const supabase = createServiceSupabase();

  const { data: orc } = await supabase
    .from("orcamentos")
    .select("id, tenant_id, numero, titulo, total, moeda")
    .eq("id", orcamentoId)
    .maybeSingle();

  if (!orc) {
    return NextResponse.json({ erro: "Orçamento não encontrado." }, { status: 404 });
  }
  if (!orc.total || Number(orc.total) <= 0) {
    return NextResponse.json({ erro: "Orçamento sem valor a pagar." }, { status: 400 });
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("mp_access_token, nome_empresa")
    .eq("id", orc.tenant_id)
    .maybeSingle();

  if (!tenant?.mp_access_token) {
    return NextResponse.json(
      { erro: "O prestador ainda não conectou o Mercado Pago." },
      { status: 409 },
    );
  }

  const siteUrl = getSiteUrl();
  const ehLocalhost = siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1");
  const titulo =
    orc.titulo || `Orçamento ${orc.numero ?? ""}`.trim() || "Pagamento";

  try {
    const preference = new Preference(getMercadoPagoClientFor(tenant.mp_access_token));

    const result = await preference.create({
      body: {
        items: [
          {
            id: orc.id,
            title: titulo,
            quantity: 1,
            unit_price: Number(orc.total),
            currency_id: orc.moeda,
          },
        ],
        metadata: { orcamento_id: orc.id, tenant_id: orc.tenant_id },
        external_reference: orc.id,
        statement_descriptor: (tenant.nome_empresa || "ORCAMENTO").slice(0, 22),
        back_urls: {
          success: `${siteUrl}/pagar/${orc.id}?status=success`,
          pending: `${siteUrl}/pagar/${orc.id}?status=pending`,
          failure: `${siteUrl}/pagar/${orc.id}?status=failure`,
        },
        ...(ehLocalhost ? {} : { auto_return: "approved" as const }),
        // tenant/orcamento na URL: o webhook precisa do token do prestador
        // (que criou o pagamento) para consultá-lo na API do Mercado Pago.
        notification_url: `${siteUrl}/api/mp/webhook-orcamento?tenant=${orc.tenant_id}&orcamento=${orc.id}`,
      },
    });

    return NextResponse.json({
      preferenceId: result.id,
      initPoint: result.init_point,
    });
  } catch (err) {
    console.error("[mp/pagar-orcamento] erro:", err);
    return NextResponse.json(
      { erro: "Não foi possível iniciar o pagamento. Tente novamente." },
      { status: 502 },
    );
  }
}
