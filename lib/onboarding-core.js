/**
 * Núcleo PURO das decisões do webhook de pagamento (sem rede, sem env, sem DB).
 *
 * Separa DE PROPÓSITO os dois lados, para que a robustez do onboarding não
 * arraste, em nenhuma retentativa, um efeito de dinheiro:
 *
 *   - LADO PAGAMENTO (idempotente): `decidirEstensaoPagamento`. Só age na
 *     PRIMEIRA vez que o mp_payment_id é visto. Duplicado ⇒ SEMPRE não age
 *     (nunca estende vencimento nem conta receita duas vezes). A gravação da
 *     venda em si é protegida à parte por assinaturas.mp_payment_id (UNIQUE).
 *
 *   - LADO ONBOARDING (recuperável): `decidirOnboarding`. Decide (re)envio do
 *     token+e-mail a partir SÓ do estado do onboarding — a função NEM RECEBE o
 *     estado do pagamento, então é estruturalmente impossível uma decisão de
 *     onboarding disparar um efeito de pagamento.
 *
 * Puro/determinístico — testável direto por `node --test` (padrão mp-paises.js).
 */

/**
 * Deve aplicar o efeito de PAGAMENTO da renovação (estender o vencimento)?
 *
 * Verdadeiro apenas quando é a PRIMEIRA vez que este pagamento é processado
 * (não duplicado) E já existe um tenant para o e-mail (renovação). Em qualquer
 * retentativa (pagamentoDuplicado === true) retorna false — a idempotência do
 * pagamento fica 100% intacta: nunca estende/contabiliza duas vezes.
 *
 * @param {{ pagamentoDuplicado: boolean, tenantExiste: boolean }} estado
 * @returns {boolean}
 */
export function decidirEstensaoPagamento(estado) {
  const pagamentoDuplicado = !!(estado && estado.pagamentoDuplicado);
  const tenantExiste = !!(estado && estado.tenantExiste);
  return !pagamentoDuplicado && tenantExiste;
}

/**
 * Ação de ONBOARDING (token + e-mail de ativação) — recuperável e independente
 * do pagamento. NÃO recebe estado de pagamento de propósito.
 *
 *   tenantExiste                         → "nenhum"        (já tem acesso)
 *   token utilizável & e-mail confirmado → "nenhum"        (já entregue; não spammar)
 *   token utilizável & e-mail não confirmado → "reenviar"  (reusa o token; reenvia)
 *   sem token utilizável                 → "criar_e_enviar" (gera token novo; envia)
 *
 * "token utilizável" = existe, não usado e não expirado.
 * "e-mail confirmado" = onboarding_tokens.email_enviado_em preenchido.
 *
 * @param {{ tenantExiste: boolean, tokenUtilizavel: boolean, emailConfirmado: boolean }} estado
 * @returns {"criar_e_enviar" | "reenviar" | "nenhum"}
 */
export function decidirOnboarding(estado) {
  const tenantExiste = !!(estado && estado.tenantExiste);
  const tokenUtilizavel = !!(estado && estado.tokenUtilizavel);
  const emailConfirmado = !!(estado && estado.emailConfirmado);

  if (tenantExiste) return "nenhum";
  if (tokenUtilizavel && emailConfirmado) return "nenhum";
  if (tokenUtilizavel) return "reenviar";
  return "criar_e_enviar";
}
