/**
 * Tipagem do núcleo puro de decisões do webhook (lib/onboarding-core.js).
 * Runtime no .js (importável por `node --test` sem build); tipos aqui.
 */

export type AcaoOnboarding = "criar_e_enviar" | "reenviar" | "nenhum";

export function decidirEstensaoPagamento(estado: {
  pagamentoDuplicado: boolean;
  tenantExiste: boolean;
}): boolean;

export function decidirOnboarding(estado: {
  tenantExiste: boolean;
  tokenUtilizavel: boolean;
  emailConfirmado: boolean;
}): AcaoOnboarding;
