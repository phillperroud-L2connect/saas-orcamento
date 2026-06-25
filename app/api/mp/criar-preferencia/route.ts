import { NextResponse } from "next/server";
import { Preference } from "mercadopago";
import { getMercadoPagoClient, getSiteUrl } from "@/lib/mercadopago";
import { getPlano } from "@/lib/planos";

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
  let body: {
    plano?: string;
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

  try {
    const preference = new Preference(getMercadoPagoClient());

    const result = await preference.create({
      body: {
        items: [
          {
            id: plano.id,
            title: `Plano ${plano.nome} — Gerador de Orçamento`,
            description: plano.descricao,
            quantity: 1,
            unit_price: plano.preco,
            currency_id: "ARS",
          },
        ],
        payer: {
          name: nome,
          email,
        },
        // Dados do cliente que o webhook recupera ao confirmar o pagamento.
        metadata: {
          plano: plano.id,
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
        notification_url: `${siteUrl}/api/mp/webhook`,
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
