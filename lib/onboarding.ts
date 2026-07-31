import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSiteUrl } from "@/lib/mercadopago";
import { enviarLinkCadastro } from "@/lib/email";
import { decidirOnboarding } from "@/lib/onboarding-core";
import type { Periodo, Plano } from "@/lib/planos";
import type { Pais } from "@/lib/types";
import { withTimeout } from "@/lib/async";

/**
 * Entrega RECUPERÁVEL do onboarding (token de cadastro + e-mail de ativação).
 *
 * Isolado do lado PAGAMENTO de propósito: esta função NUNCA toca em
 * `assinaturas` (idempotência da cobrança) nem estende vencimento — só mexe em
 * `onboarding_tokens` e dispara o e-mail. Assim pode ser chamada com segurança
 * numa retentativa do Mercado Pago (pagamento já registrado) ou por um reenvio
 * manual/self-serve, sem risco de reprocessar dinheiro.
 *
 * Regra (ver decidirOnboarding):
 *   - tenant já existe → nada (cliente já tem acesso);
 *   - já entregue (email_enviado_em preenchido e token ainda válido) → nada;
 *   - token válido mas sem confirmação de envio → reenvia o MESMO token;
 *   - sem token válido → gera token novo (24h) e envia.
 *
 * Só marca `email_enviado_em` DEPOIS que o Resend confirma o envio. Se o envio
 * (ou a criação do token) falhar, retorna `precisaRetry: true` para o chamador
 * responder 500 e o Mercado Pago reenviar — recuperando a entrega sem reprocessar
 * o pagamento.
 */

const DB_TIMEOUT_MS = 8_000;
const EMAIL_TIMEOUT_MS = 10_000;
/** Validade do token de onboarding: 24h (igual ao fluxo original). */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export type ResultadoOnboarding = {
  /** Ação efetivamente tomada. */
  acao: "criar_e_enviar" | "reenviar" | "nenhum";
  /** true se o e-mail foi confirmado como enviado nesta chamada. */
  enviado: boolean;
  /** true se algo falhou e o chamador deve responder 500 (para reenvio/retry). */
  precisaRetry: boolean;
};

type GarantirOnboardingParams = {
  email: string;
  plano: Plano;
  periodo: Periodo;
  pais: Pais;
  /** Já existe tenant para o e-mail? (renovação / conta já ativada) */
  tenantExiste: boolean;
};

export async function garantirOnboarding(
  supabase: SupabaseClient,
  { email, plano, periodo, pais, tenantExiste }: GarantirOnboardingParams,
): Promise<ResultadoOnboarding> {
  // Estado do onboarding: o token mais recente do e-mail (se houver).
  const { data: tok } = await withTimeout(
    supabase
      .from("onboarding_tokens")
      .select("id, token, usado, expira_em, email_enviado_em")
      .eq("email", email)
      .order("expira_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
    DB_TIMEOUT_MS,
    "ler token de onboarding",
  );

  const agora = Date.now();
  const tokenUtilizavel =
    !!tok && !tok.usado && new Date(tok.expira_em).getTime() > agora;
  const emailConfirmado = !!tok && !!tok.email_enviado_em;

  const acao = decidirOnboarding({ tenantExiste, tokenUtilizavel, emailConfirmado });
  if (acao === "nenhum") {
    return { acao, enviado: false, precisaRetry: false };
  }

  // Resolve o token: reusa o válido (reenvio) ou cria um novo (24h).
  let tokenValor: string;
  let tokenId: string;
  if (acao === "reenviar" && tok) {
    tokenValor = String(tok.token);
    tokenId = String(tok.id);
  } else {
    tokenValor = crypto.randomUUID();
    const expiraEm = new Date(agora + TOKEN_TTL_MS);
    const { data: novo, error: criarErr } = await withTimeout(
      supabase
        .from("onboarding_tokens")
        .insert({
          email,
          token: tokenValor,
          plano: plano.id,
          periodo,
          pais,
          expira_em: expiraEm.toISOString(),
        })
        .select("id")
        .single(),
      DB_TIMEOUT_MS,
      "criar token de onboarding",
    );
    if (criarErr || !novo) {
      console.error("[onboarding] falha ao criar token:", criarErr);
      return { acao, enviado: false, precisaRetry: true };
    }
    tokenId = String(novo.id);
  }

  // Envia o e-mail de ativação. Só carimba entrega se o Resend confirmar.
  const linkCadastro = `${getSiteUrl()}/cadastro?token=${tokenValor}`;
  const enviado = await withTimeout(
    enviarLinkCadastro({ email, plano, linkCadastro, pais }),
    EMAIL_TIMEOUT_MS,
    "e-mail link de cadastro",
  );

  if (!enviado) {
    // Não marca como entregue → a retentativa reenvia (recuperável), sem
    // reprocessar o pagamento.
    return { acao, enviado: false, precisaRetry: true };
  }

  await withTimeout(
    supabase
      .from("onboarding_tokens")
      .update({ email_enviado_em: new Date().toISOString() })
      .eq("id", tokenId),
    DB_TIMEOUT_MS,
    "marcar e-mail de onboarding como enviado",
  );

  return { acao, enviado: true, precisaRetry: false };
}
