import { NextResponse } from "next/server";
import { Payment } from "mercadopago";
import { getMercadoPagoClient, getSiteUrl } from "@/lib/mercadopago";
import { createServiceSupabase } from "@/lib/supabase-service";
import { getPlano } from "@/lib/planos";
import { enviarLinkCadastro, notificarAdminNovaVenda } from "@/lib/email";

/**
 * POST /api/mp/webhook
 *
 * Notificação do Mercado Pago. Quando um pagamento é aprovado:
 *   1. (idempotência) registra a venda em `assinaturas` pelo mp_payment_id;
 *   2. gera um token de onboarding (24h) em `onboarding_tokens` com o e-mail
 *      do pagador e o plano contratado;
 *   3. envia ao pagador o link tokenizado de cadastro (/cadastro?token=...)
 *      via Resend e notifica o admin da nova venda.
 *
 * O tenant NÃO é mais criado aqui: o cliente define a senha pelo link e a
 * conta + tenant são provisionados em /api/cadastro/token.
 *
 * Sempre responde 200 para eventos tratados/ignorados (evita reenvios infinitos
 * do MP). Só responde 500 em falhas transitórias, para o MP tentar de novo.
 */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);

  // O MP envia o tipo em `type` (webhooks novos) ou `topic` (IPN antigo),
  // e o id do recurso em `data.id` (query) ou no corpo { data: { id } }.
  let bodyJson: { type?: string; action?: string; data?: { id?: string } } = {};
  try {
    bodyJson = await req.json();
  } catch {
    // Algumas notificações vêm sem corpo — os dados estão na query.
  }

  const tipo = searchParams.get("type") ?? searchParams.get("topic") ?? bodyJson.type;
  const paymentId =
    searchParams.get("data.id") ?? searchParams.get("id") ?? bodyJson.data?.id;

  // Só nos interessa o tópico de pagamento.
  if (tipo !== "payment" || !paymentId) {
    return NextResponse.json({ ignorado: true }, { status: 200 });
  }

  try {
    const payment = await new Payment(getMercadoPagoClient()).get({
      id: paymentId,
    });

    if (payment.status !== "approved") {
      // Pendente/recusado: nada a provisionar ainda.
      return NextResponse.json({ status: payment.status }, { status: 200 });
    }

    const meta = (payment.metadata ?? {}) as Record<string, unknown>;
    const plano = getPlano(String(meta.plano ?? ""));
    const nome = String(meta.nome ?? payment.payer?.first_name ?? "").trim();
    const email = String(meta.email ?? payment.payer?.email ?? "")
      .trim()
      .toLowerCase();
    const whatsapp = String(meta.whatsapp ?? "").trim() || null;

    if (!plano || !email) {
      console.error("[mp/webhook] metadata incompleta", { paymentId, meta });
      return NextResponse.json({ erro: "metadata incompleta" }, { status: 200 });
    }

    const supabase = createServiceSupabase();

    // --- 1. Idempotência: tenta registrar a venda primeiro. -----------------
    // mp_payment_id é UNIQUE; se já existir, foi processada — encerra aqui.
    const { error: insertErr } = await supabase.from("assinaturas").insert({
      mp_payment_id: String(payment.id),
      external_reference: payment.external_reference ?? null,
      plano: plano.id,
      nome: nome || null,
      email,
      whatsapp,
      valor: payment.transaction_amount ?? plano.preco,
      status: payment.status,
      forma_pagamento: "mercado_pago",
    });

    if (insertErr) {
      // 23505 = unique_violation → webhook duplicado, já provisionado.
      if (insertErr.code === "23505") {
        return NextResponse.json({ duplicado: true }, { status: 200 });
      }
      console.error("[mp/webhook] erro ao registrar assinatura:", insertErr);
      return NextResponse.json({ erro: "db" }, { status: 500 });
    }

    // --- 2. Onboarding: gera o token de cadastro (válido por 24h). ----------
    // Em vez de criar o tenant agora, o cliente define a senha pelo link
    // tokenizado; a conta + tenant são provisionados em /api/cadastro/token.
    const token = crypto.randomUUID();
    const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const { error: tokenErr } = await supabase.from("onboarding_tokens").insert({
      email,
      token,
      plano: plano.id,
      expira_em: expiraEm.toISOString(),
    });

    if (tokenErr) {
      console.error("[mp/webhook] erro ao gravar token de onboarding:", tokenErr);
      return NextResponse.json({ erro: "db" }, { status: 500 });
    }

    const linkCadastro = `${getSiteUrl()}/cadastro?token=${token}`;

    // --- 3. E-mails (best-effort — não derrubam o webhook). -----------------
    await Promise.allSettled([
      enviarLinkCadastro({ email, plano, linkCadastro }),
      notificarAdminNovaVenda({ nome: nome || email, email, whatsapp, plano }),
    ]);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[mp/webhook] erro inesperado:", err);
    // 500 → o Mercado Pago reenvia a notificação mais tarde.
    return NextResponse.json({ erro: "interno" }, { status: 500 });
  }
}
