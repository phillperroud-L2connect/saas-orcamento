import { NextResponse } from "next/server";
import { Preference } from "mercadopago";
import { getMercadoPagoClient, getSiteUrl } from "@/lib/mercadopago";
import {
  getPlano,
  getPrecoPorPeriodo,
  isPeriodo,
  moedaAssinatura,
} from "@/lib/planos";
import { normalizarPais } from "@/lib/mp-paises";
import {
  aplicarRateLimit,
  limiterPagamento,
  getClientIp,
  tooManyRequests,
} from "@/lib/rate-limit";

/**
 * POST /api/mp/criar-preferencia
 *
 * Recebe o plano escolhido + dados do cliente e cria uma preferência de
 * pagamento no Mercado Pago (Argentina). Devolve o preference_id (consumido
 * pelo Wallet Brick no front) e o init_point (fallback de redirect).
 *
 * Rota pública (sem login) — o acesso só é provisionado depois, no webhook,
 * quando o pagamento é efetivamente aprovado.
 */
export async function POST(req: Request) {
  // Rate limit por IP: cria preferência de pagamento no MP (mesmo limite do
  // pagamento de orçamento). Protege o checkout público contra abuso.
  const rl = await aplicarRateLimit(limiterPagamento, `criar-pref:${getClientIp(req)}`);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  let body: {
    plano?: string;
    periodo?: string;
    pais?: string;
    nome?: string;
    email?: string;
    whatsapp?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const plano = getPlano(body.plano ?? "");
  // Período opcional — default "mensal" caso o cliente não envie/envie inválido.
  const periodo = isPeriodo(body.periodo ?? "") ? (body.periodo as "mensal" | "anual") : "mensal";
  // País da conta que está assinando (deriva do idioma do checkout no client).
  // Fora de {AR,BR} → "AR" (preserva o fluxo argentino como default seguro).
  const pais = normalizarPais(body.pais);
  const nome = body.nome?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const whatsapp = body.whatsapp?.trim() ?? "";

  if (!plano) {
    return NextResponse.json({ erro: "Plano inválido." }, { status: 400 });
  }
  if (!nome || !email) {
    return NextResponse.json(
      { erro: "Nome e e-mail são obrigatórios." },
      { status: 400 },
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ erro: "E-mail inválido." }, { status: 400 });
  }

  const siteUrl = getSiteUrl();
  const ehLocalhost = siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1");

  // Valor + moeda conforme o país e o período escolhido (AR→ARS, BR→BRL).
  const unitPrice = getPrecoPorPeriodo(plano, periodo, pais);
  const moeda = moedaAssinatura(pais);
  const sufixoPeriodo = periodo === "anual" ? "Anual" : "Mensal";

  try {
    // Gaveta de credenciais conforme o país (conta AR ou BR do dono do SaaS).
    const preference = new Preference(getMercadoPagoClient(pais));

    const result = await preference.create({
      body: {
        items: [
          {
            id: plano.id,
            title: `Plano ${plano.nome} ${sufixoPeriodo} — Gerador de Orçamento`,
            description: plano.descricao,
            quantity: 1,
            unit_price: unitPrice,
            currency_id: moeda,
          },
        ],
        payer: {
          name: nome,
          email,
        },
        // Dados do cliente que o webhook recupera ao confirmar o pagamento.
        metadata: {
          plano: plano.id,
          periodo,
          pais,
          nome,
          email,
          whatsapp,
        },
        external_reference: `${plano.id}:${email}`,
        statement_descriptor: "GERADOR ORCAMENTO",
        back_urls: {
          success: `${siteUrl}/checkout/sucesso`,
          pending: `${siteUrl}/checkout/sucesso?status=pending`,
          failure: `${siteUrl}/checkout/${plano.id}?status=failure`,
        },
        // auto_return exige back_urls https — só ativa fora do localhost.
        ...(ehLocalhost ? {} : { auto_return: "approved" as const }),
        // `pais` na query: o webhook precisa saber em qual conta (AR/BR)
        // consultar o pagamento — cada conta só enxerga os próprios pagamentos.
        notification_url: `${siteUrl}/api/mp/webhook?pais=${pais}`,
      },
    });

    return NextResponse.json({
      preferenceId: result.id,
      initPoint: result.init_point,
    });
  } catch (err) {
    console.error("[mp/criar-preferencia] erro:", err);
    return NextResponse.json(
      { erro: "Não foi possível iniciar o pagamento. Tente novamente." },
      { status: 502 },
    );
  }
}
