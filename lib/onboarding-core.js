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
 * `forcarReenvio` (default false): usado SÓ pelo reenvio manual do admin (ação
 * humana deliberada). Quando true, ignora o curto-circuito "e-mail confirmado →
 * nenhum", forçando um novo envio mesmo que o Resend já tenha confirmado o 1º
 * e-mail (cliente que recebeu e perdeu / caiu no spam). Reusa o token válido se
 * houver ("reenviar"); senão gera um novo ("criar_e_enviar"). O webhook do MP
 * NUNCA passa true — assim as retentativas automáticas jamais reenviam em
 * duplicidade. `tenantExiste` continua tendo prioridade (nunca reenvia a quem já
 * ativou), mesmo com forcarReenvio.
 *
 * @param {{ tenantExiste: boolean, tokenUtilizavel: boolean, emailConfirmado: boolean, forcarReenvio?: boolean }} estado
 * @returns {"criar_e_enviar" | "reenviar" | "nenhum"}
 */
export function decidirOnboarding(estado) {
  const tenantExiste = !!(estado && estado.tenantExiste);
  const tokenUtilizavel = !!(estado && estado.tokenUtilizavel);
  const emailConfirmado = !!(estado && estado.emailConfirmado);
  const forcarReenvio = !!(estado && estado.forcarReenvio);

  if (tenantExiste) return "nenhum";
  if (tokenUtilizavel && emailConfirmado && !forcarReenvio) return "nenhum";
  if (tokenUtilizavel) return "reenviar";
  return "criar_e_enviar";
}

/**
 * Regra de negócio do REENVIO MANUAL de ativação (painel admin). Pura, sem DB.
 *
 * Só faz sentido reenviar o link de ativação para quem PAGOU mas AINDA NÃO
 * ativou a conta (assinatura aprovada + sem tenant). Quem já ativou tem acesso;
 * quem não pagou não tem o que ativar.
 *
 *   sem assinatura paga → { permitido:false, motivo:"sem_assinatura_paga" }
 *   já tem tenant       → { permitido:false, motivo:"ja_ativado" }
 *   pago & sem tenant   → { permitido:true,  motivo:null }
 *
 * @param {{ temAssinaturaPaga: boolean, tenantExiste: boolean }} estado
 * @returns {{ permitido: boolean, motivo: "sem_assinatura_paga" | "ja_ativado" | null }}
 */
export function decidirReenvioAtivacao(estado) {
  const temAssinaturaPaga = !!(estado && estado.temAssinaturaPaga);
  const tenantExiste = !!(estado && estado.tenantExiste);

  if (!temAssinaturaPaga) return { permitido: false, motivo: "sem_assinatura_paga" };
  if (tenantExiste) return { permitido: false, motivo: "ja_ativado" };
  return { permitido: true, motivo: null };
}

/**
 * Milissegundos a aguardar para PADRONIZAR o tempo de resposta da rota pública
 * de reativação (/api/cadastro/reenviar). Retorna o restante de um orçamento
 * fixo, NUNCA negativo: se o trabalho real já excedeu o orçamento, aguarda 0
 * (não dá para "voltar no tempo"; o resíduo é aceito conscientemente). Pura para
 * travar o invariante de que o pad jamais é negativo/ NaN — o que quebraria a
 * defesa de timing (anti-enumeração) ou faria o handler dormir para sempre.
 *
 * @param {number} budgetMs orçamento total (ex.: 1500)
 * @param {number} decorridoMs tempo já gasto até aqui (agora - t0)
 * @returns {number} ms a dormir, sempre em [0, budgetMs]
 */
export function padDeTempo(budgetMs, decorridoMs) {
  const budget = Number.isFinite(budgetMs) && budgetMs > 0 ? budgetMs : 0;
  const decorrido = Number.isFinite(decorridoMs) && decorridoMs > 0 ? decorridoMs : 0;
  const restante = budget - decorrido;
  return restante > 0 ? restante : 0;
}
