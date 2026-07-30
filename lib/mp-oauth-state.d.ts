/**
 * Tipagem do núcleo puro da assinatura do `state` do OAuth do Mercado Pago
 * (lib/mp-oauth-state.js). O runtime mora no .js (testável por `node --test`);
 * este .d.ts dá ao TypeScript as assinaturas usadas pelos route handlers e pela
 * página de callback.
 */

/** Nonce aleatório URL-safe para o par state/cookie anti-CSRF. */
export function gerarNonce(): string;

/**
 * Assina o state. Lança se faltar segredo/tenant/nonce (o fail-closed do
 * segredo é responsabilidade de quem lê o env).
 */
export function assinarState(
  dados: { tenantId: string; nonce: string; iat?: number },
  secret: string,
): string;

/** Resultado da verificação: sucesso com os campos ou falha com o motivo. */
export type VerificacaoState =
  | { ok: true; tenantId: string; nonce: string; iat: number }
  | { ok: false; motivo: string };

/** Verifica assinatura + expiração. Nunca lança. */
export function verificarState(
  token: unknown,
  secret: string | undefined | null,
  opcoes?: { maxIdadeSegundos?: number; agoraMs?: number },
): VerificacaoState;
