import { NextResponse } from "next/server";
import { Payment } from "mercadopago";
import { getMercadoPagoClient, getSiteUrl } from "@/lib/mercadopago";
import { createServiceSupabase } from "@/lib/supabase-service";
import { getPlano, type Plano } from "@/lib/planos";
import { enviarBoasVindas, notificarAdminNovaVenda } from "@/lib/email";

/**
 * POST /api/mp/webhook
 *
 * Notificação do Mercado Pago. Quando um pagamento é aprovado:
 *   1. (idempotência) registra a venda em `assinaturas` pelo mp_payment_id;
 *   2. cria o usuário no Supabase Auth — o trigger on_auth_user_created
 *      provisiona automaticamente o tenant + a linha em public.users;
 *   3. ajusta o tenant para a região AR e marca o plano contratado;
 *   4. envia e-mail de boas-vindas (link de acesso) e notifica o admin.
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
    const periodo = String(meta.periodo ?? "mensal") === "anual" ? "anual" : "mensal";
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

    // --- 2. Provisiona o acesso (auth user → trigger cria tenant). ----------
    const { tenantId, linkAcesso } = await provisionarAcesso(supabase, {
      nome: nome || email,
      email,
      plano,
      periodo,
    });

    if (tenantId) {
      await supabase
        .from("assinaturas")
        .update({ tenant_id: tenantId })
        .eq("mp_payment_id", String(payment.id));
    }

    // --- 3. E-mails (best-effort — não derrubam o webhook). -----------------
    await Promise.allSettled([
      enviarBoasVindas({ nome: nome || email, email, plano, linkAcesso }),
      notificarAdminNovaVenda({ nome: nome || email, email, whatsapp, plano }),
    ]);

    return NextResponse.json({ ok: true, tenantId }, { status: 200 });
  } catch (err) {
    console.error("[mp/webhook] erro inesperado:", err);
    // 500 → o Mercado Pago reenvia a notificação mais tarde.
    return NextResponse.json({ erro: "interno" }, { status: 500 });
  }
}

type ProvisionarParams = {
  nome: string;
  email: string;
  plano: Plano;
  periodo: "mensal" | "anual";
};

/**
 * Cria o usuário no Supabase Auth (o trigger cria tenant + users) e devolve o
 * link de acesso. Se o usuário já existir (cliente recorrente / retry tardio),
 * reaproveita a conta. Ajusta o tenant para região AR e marca o plano.
 */
async function provisionarAcesso(
  supabase: ReturnType<typeof createServiceSupabase>,
  { nome, email, plano, periodo }: ProvisionarParams,
): Promise<{ tenantId: string | null; linkAcesso: string }> {
  const siteUrl = getSiteUrl();
  const loginUrl = `${siteUrl}/login`;

  // Cria a conta já confirmada, com senha aleatória — o cliente define a dele
  // pelo link de recuperação enviado no e-mail de boas-vindas.
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password: crypto.randomUUID() + "Aa1!",
    user_metadata: { nome },
  });

  const userId = created?.user?.id ?? null;

  // Usuário já existia: segue o fluxo reaproveitando a conta.
  if (createErr && !userId) {
    const jaExiste =
      createErr.status === 422 ||
      /already.*registered|already.*exists/i.test(createErr.message ?? "");
    if (!jaExiste) {
      console.error("[mp/webhook] erro ao criar usuário:", createErr);
    }
  }

  // Vincula tenant: o trigger já criou tenant + users para a conta nova.
  let tenantId: string | null = null;
  if (userId) {
    const { data: userRow } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();
    tenantId = userRow?.tenant_id ?? null;
  }

  // Ajusta região (Argentina), registra o plano e a assinatura como paga.
  if (tenantId) {
    // Vencimento conforme o período pago: +1 mês ou +1 ano.
    const venc = new Date();
    if (periodo === "anual") venc.setFullYear(venc.getFullYear() + 1);
    else venc.setMonth(venc.getMonth() + 1);

    await supabase
      .from("tenants")
      .update({
        pais: "AR",
        idioma: "es",
        moeda_preferida: "ARS",
        plano: plano.id,
        ativo: true,
        status_assinatura: "pago",
        forma_pagamento: "mercado_pago",
        vencimento: venc.toISOString().slice(0, 10),
      })
      .eq("id", tenantId);
  }

  // Link de definição de senha (recovery). Se falhar, cai para a tela de login.
  let linkAcesso = loginUrl;
  const { data: linkData } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${siteUrl}/login` },
  });
  if (linkData?.properties?.action_link) {
    linkAcesso = linkData.properties.action_link;
  }

  return { tenantId, linkAcesso };
}
