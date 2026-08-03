import { NextResponse } from "next/server";
import { Payment } from "mercadopago";
import {
  getMercadoPagoClient,
  verificarAssinaturaMpWebhook,
} from "@/lib/mercadopago";
import { createServiceSupabase } from "@/lib/supabase-service";
import { getPlano, getPrecoPorPeriodo, isPeriodo } from "@/lib/planos";
import { normalizarPais, moedaAssinatura } from "@/lib/mp-paises";
import { notificarAdminNovaVenda } from "@/lib/email";
import { garantirOnboarding } from "@/lib/onboarding";
import { decidirEstensaoPagamento } from "@/lib/onboarding-core";
import {
  aplicarRateLimit,
  limiterWebhook,
  getClientIp,
  tooManyRequests,
} from "@/lib/rate-limit";
import { withTimeout } from "@/lib/async";
import { registrarEventoPagamento } from "@/lib/payment-audit";
import { mapStatusParaEvento } from "@/lib/payment-audit-core";

/** Watchdogs para as chamadas de rede/DB do webhook (ms). */
const MP_TIMEOUT_MS = 10_000;
const DB_TIMEOUT_MS = 8_000;
const EMAIL_TIMEOUT_MS = 10_000;

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
  // Rate limit por IP (rajadas legítimas do MP cabem no limite generoso).
  const rl = await aplicarRateLimit(limiterWebhook, `webhook:${getClientIp(req)}`);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

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
  // País da conta gravado no notification_url (?pais=AR|BR) ao criar a
  // preferência. Determina em qual gaveta de credenciais consultar o pagamento
  // — cada conta MP só enxerga os próprios pagamentos. Default "AR" (legado).
  const pais = normalizarPais(searchParams.get("pais"));

  // Autenticidade: rejeita qualquer requisição que não venha do Mercado Pago
  // (assinatura x-signature inválida/ausente ou secret não configurada).
  const assinatura = verificarAssinaturaMpWebhook(req, paymentId ?? null, pais);
  if (!assinatura.ok) {
    console.warn("[mp/webhook] assinatura rejeitada:", assinatura.motivo);
    return NextResponse.json({ erro: "assinatura_invalida" }, { status: 401 });
  }

  // Só nos interessa o tópico de pagamento.
  if (tipo !== "payment" || !paymentId) {
    return NextResponse.json({ ignorado: true }, { status: 200 });
  }

  try {
    const payment = await withTimeout(
      new Payment(getMercadoPagoClient(pais)).get({ id: paymentId }),
      MP_TIMEOUT_MS,
      "consultar pagamento no Mercado Pago",
    );

    // Trilha de auditoria (best-effort): registra o evento recebido com o
    // status atual, antes de qualquer provisionamento. Não bloqueia o webhook.
    await registrarEventoPagamento({
      evento: mapStatusParaEvento(payment.status),
      origem: "assinatura",
      mpPaymentId: payment.id,
      externalReference: payment.external_reference ?? null,
      status: payment.status ?? null,
      valor: payment.transaction_amount ?? null,
    });

    if (payment.status !== "approved") {
      // Pendente/recusado: nada a provisionar ainda.
      return NextResponse.json({ status: payment.status }, { status: 200 });
    }

    const meta = (payment.metadata ?? {}) as Record<string, unknown>;

    // Fallback: quando o pagador oculta os dados (hide_payer_information) ou o
    // Mercado Pago não devolve `metadata`/`payer.email`, extraímos plano e
    // e-mail do `external_reference` — gravado por nós na preferência no
    // formato "<plano>:<email>" (ver app/api/mp/criar-preferencia). Isolado em
    // try/catch para nunca derrubar o webhook por um formato inesperado.
    let refPlano = "";
    let refEmail = "";
    try {
      const ref = String(payment.external_reference ?? "");
      const sep = ref.indexOf(":");
      if (sep > 0) {
        refPlano = ref.slice(0, sep).trim();
        refEmail = ref.slice(sep + 1).trim();
      }
    } catch (refErr) {
      console.error(
        "[mp/webhook] falha ao parsear external_reference:",
        refErr,
      );
    }

    // Prioridade: metadata → payer → external_reference. `|| ...` (não `??`)
    // porque metadata pode vir com string vazia, não só ausente.
    const plano = getPlano(String(meta.plano ?? "").trim() || refPlano);
    const periodoMeta = String(meta.periodo ?? "");
    const periodo = isPeriodo(periodoMeta) ? periodoMeta : "mensal";
    const nome = String(meta.nome ?? payment.payer?.first_name ?? "").trim();
    const email = (
      String(meta.email ?? "").trim() ||
      String(payment.payer?.email ?? "").trim() ||
      refEmail
    )
      .trim()
      .toLowerCase();
    const whatsapp = String(meta.whatsapp ?? "").trim() || null;

    if (!plano || !email) {
      console.error("[mp/webhook] plano/e-mail ausentes (metadata + external_reference)", {
        paymentId,
        meta,
        external_reference: payment.external_reference ?? null,
      });
      return NextResponse.json({ erro: "metadata incompleta" }, { status: 200 });
    }

    const supabase = createServiceSupabase();

    // --- 1. Renovação x venda nova. -----------------------------------------
    // Se já existe um tenant com esse e-mail, o pagamento é uma RENOVAÇÃO.
    // A busca vem ANTES do insert de propósito: se ela falhar, respondemos 500
    // sem gravar nada e o Mercado Pago reenvia com segurança (a idempotência do
    // insert impede reprocessar quando a busca dá certo). Comparação por e-mail
    // exato (lowercase) — tenants.email vem do auth, sempre em minúsculas.
    const { data: tenantExistente } = await withTimeout(
      supabase
        .from("tenants")
        .select("id, vencimento")
        .eq("email", email)
        .maybeSingle(),
      DB_TIMEOUT_MS,
      "buscar tenant por e-mail",
    );

    // Moeda do pagamento derivada do país da conta (BR → BRL, senão ARS).
    // Isolado em try/catch para nunca derrubar o webhook: na falha improvável,
    // cai no default 'ARS' (idêntico ao default da coluna) e loga para auditoria.
    let moeda: "ARS" | "BRL" = "ARS";
    try {
      moeda = moedaAssinatura(pais);
    } catch (moedaErr) {
      console.error(
        "[mp/webhook] falha ao determinar moeda, usando ARS:",
        moedaErr,
      );
    }

    // --- 2. Idempotência: registra a venda. ---------------------------------
    // mp_payment_id é UNIQUE; se já existir, foi processada — encerra aqui.
    // Numa renovação já vinculamos a venda ao tenant existente.
    const { error: insertErr } = await withTimeout(
      supabase.from("assinaturas").insert({
        mp_payment_id: String(payment.id),
        external_reference: payment.external_reference ?? null,
        plano: plano.id,
        nome: nome || null,
        email,
        whatsapp,
        valor: payment.transaction_amount ?? getPrecoPorPeriodo(plano, periodo, pais),
        moeda,
        status: payment.status,
        forma_pagamento: "mercado_pago",
        tenant_id: tenantExistente?.id ?? null,
      }),
      DB_TIMEOUT_MS,
      "registrar assinatura",
    );

    // Pagamento duplicado (retentativa do MP): NÃO é reprocessado. A cobrança
    // já está registrada e é idempotente via mp_payment_id (UNIQUE). Seguimos
    // adiante APENAS para garantir a entrega do onboarding, se ainda faltar.
    let pagamentoDuplicado = false;
    if (insertErr) {
      if (insertErr.code === "23505") {
        pagamentoDuplicado = true;
      } else {
        console.error("[mp/webhook] erro ao registrar assinatura:", insertErr);
        return NextResponse.json({ erro: "db" }, { status: 500 });
      }
    }

    const tenantExiste = !!tenantExistente?.id;

    // --- 3. LADO PAGAMENTO (renovação): estende o vencimento SÓ na 1ª vez. ---
    // decidirEstensaoPagamento garante a idempotência: em QUALQUER retentativa
    // (pagamentoDuplicado === true) o resultado é false — nunca estende o
    // vencimento nem conta receita duas vezes. Espelha o "Marcar como pago" do
    // admin, estendendo a partir do vencimento atual (se ainda no futuro).
    if (
      decidirEstensaoPagamento({ pagamentoDuplicado, tenantExiste }) &&
      tenantExistente?.id
    ) {
      try {
        const agora = new Date();
        const base =
          tenantExistente.vencimento &&
          new Date(`${tenantExistente.vencimento}T23:59:59`) > agora
            ? new Date(`${tenantExistente.vencimento}T00:00:00`)
            : agora;
        base.setMonth(base.getMonth() + (periodo === "anual" ? 12 : 1));
        const novoVencimento = base.toISOString().slice(0, 10);

        await withTimeout(
          supabase
            .from("tenants")
            .update({
              plano: plano.id,
              status_assinatura: "pago",
              ativo: true,
              forma_pagamento: "mercado_pago",
              vencimento: novoVencimento,
            })
            .eq("id", tenantExistente.id),
          DB_TIMEOUT_MS,
          "estender vencimento do tenant (renovação)",
        );
      } catch (renovErr) {
        // Venda já registrada (idempotência impede reprocesso). Loga para o
        // admin reconciliar manualmente pelo botão "Marcar como pago".
        console.error(
          "[mp/webhook] falha ao estender vencimento (renovação):",
          renovErr,
        );
      }

      // Auditoria enriquecida com o tenant da renovação (best-effort).
      await registrarEventoPagamento({
        evento: "aprovado",
        origem: "assinatura",
        tenantId: tenantExistente.id,
        mpPaymentId: payment.id,
        externalReference: payment.external_reference ?? null,
        status: payment.status ?? null,
        valor: payment.transaction_amount ?? getPrecoPorPeriodo(plano, periodo, pais),
        detalhe: { renovacao: true, plano: plano.id, periodo },
      });
    }

    // --- 4. LADO ONBOARDING (recuperável): garante token + e-mail. ----------
    // NÃO toca em `assinaturas` nem estende vencimento — só onboarding_tokens +
    // e-mail. Seguro em retentativa: (re)gera o token e reenvia o link enquanto
    // a entrega não for confirmada, sem reprocessar o pagamento. Se o tenant já
    // existe (renovação), a função é no-op (o cliente já tem acesso).
    const onb = await garantirOnboarding(supabase, {
      email,
      plano,
      periodo,
      pais,
      tenantExiste,
    });

    // Notifica o admin da venda apenas na PRIMEIRA vez (não duplicado), para não
    // reenviar a notificação a cada retentativa. Best-effort (não derruba nada).
    if (!pagamentoDuplicado) {
      await Promise.allSettled([
        withTimeout(
          notificarAdminNovaVenda({ nome: nome || email, email, whatsapp, plano, periodo, pais }),
          EMAIL_TIMEOUT_MS,
          "e-mail notificar admin",
        ),
      ]);
    }

    // Entrega do onboarding falhou (e-mail/token) → 500 para o Mercado Pago
    // reenviar e recuperar. O pagamento NÃO é reprocessado na retentativa
    // (assinatura já registrada, idempotente); só o onboarding é refeito.
    if (onb.precisaRetry) {
      return NextResponse.json({ erro: "onboarding_pendente" }, { status: 500 });
    }

    return NextResponse.json(
      { ok: true, renovacao: tenantExiste, onboarding: onb.acao },
      { status: 200 },
    );
  } catch (err) {
    console.error("[mp/webhook] erro inesperado:", err);
    // 500 → o Mercado Pago reenvia a notificação mais tarde.
    return NextResponse.json({ erro: "interno" }, { status: 500 });
  }
}
