import { NextResponse } from "next/server";
import { Payment } from "mercadopago";
import { getMercadoPagoClientFor } from "@/lib/mercadopago";
import { createServiceSupabase } from "@/lib/supabase-service";
import { notificarPrestadorPagamento } from "@/lib/email";
import { fmtMoeda } from "@/lib/moeda";
import type { MoedaPreferida } from "@/lib/types";

/**
 * POST /api/mp/webhook-orcamento?tenant=...&orcamento=...
 *
 * Notificação do Mercado Pago para pagamentos de ORÇAMENTOS (clientes finais).
 * Como o pagamento foi criado com o token do prestador, ele só pode ser
 * consultado com esse mesmo token — por isso o `tenant` vem na query (definido
 * na notification_url ao criar a preferência).
 *
 * Quando o pagamento é aprovado:
 *   1. marca o orçamento como 'aprovado' (idempotente);
 *   2. registra o pagamento em public.pagamentos;
 *   3. envia e-mail de notificação ao prestador.
 *
 * Sempre responde 200 para eventos tratados/ignorados (evita reenvios do MP).
 */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);

  let bodyJson: { type?: string; data?: { id?: string } } = {};
  try {
    bodyJson = await req.json();
  } catch {
    // Notificações podem vir sem corpo — dados na query.
  }

  const tipo = searchParams.get("type") ?? searchParams.get("topic") ?? bodyJson.type;
  const paymentId =
    searchParams.get("data.id") ?? searchParams.get("id") ?? bodyJson.data?.id;
  const tenantId = searchParams.get("tenant");
  const orcamentoQuery = searchParams.get("orcamento");

  if (tipo !== "payment" || !paymentId || !tenantId) {
    return NextResponse.json({ ignorado: true }, { status: 200 });
  }

  try {
    const supabase = createServiceSupabase();

    // Token do prestador — necessário para consultar o pagamento na API do MP.
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, email, mp_access_token")
      .eq("id", tenantId)
      .maybeSingle();

    if (!tenant?.mp_access_token) {
      console.error("[mp/webhook-orcamento] tenant sem token:", tenantId);
      return NextResponse.json({ ignorado: true }, { status: 200 });
    }

    const payment = await new Payment(
      getMercadoPagoClientFor(tenant.mp_access_token),
    ).get({ id: paymentId });

    if (payment.status !== "approved") {
      return NextResponse.json({ status: payment.status }, { status: 200 });
    }

    const orcamentoId = payment.external_reference || orcamentoQuery;
    if (!orcamentoId) {
      return NextResponse.json({ erro: "sem orcamento" }, { status: 200 });
    }

    // Carrega o orçamento (confere o tenant e evita duplo processamento).
    const { data: orc } = await supabase
      .from("orcamentos")
      .select("id, tenant_id, numero, titulo, total, moeda, status")
      .eq("id", orcamentoId)
      .maybeSingle();

    if (!orc || orc.tenant_id !== tenantId) {
      return NextResponse.json({ ignorado: true }, { status: 200 });
    }

    // Idempotência simples: se já está aprovado, não reprocessa nem reenvia.
    if (orc.status === "aprovado") {
      return NextResponse.json({ duplicado: true }, { status: 200 });
    }

    // 1. Marca o orçamento como aprovado.
    await supabase
      .from("orcamentos")
      .update({ status: "aprovado" })
      .eq("id", orc.id);

    // 2. Registra o pagamento.
    await supabase.from("pagamentos").insert({
      tenant_id: orc.tenant_id,
      orcamento_id: orc.id,
      tipo: "total",
      valor: payment.transaction_amount ?? orc.total,
      status: "approved",
      link_pagamento: null,
    });

    // 3. Notifica o prestador.
    const nomeCliente =
      [payment.payer?.first_name, payment.payer?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || null;
    const valorFmt = fmtMoeda(
      payment.transaction_amount ?? Number(orc.total),
      (orc.moeda as MoedaPreferida) ?? "BRL",
    );

    if (tenant.email) {
      await notificarPrestadorPagamento({
        para: tenant.email,
        nomeCliente,
        numero: orc.numero,
        valor: valorFmt,
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[mp/webhook-orcamento] erro:", err);
    return NextResponse.json({ erro: "interno" }, { status: 500 });
  }
}
