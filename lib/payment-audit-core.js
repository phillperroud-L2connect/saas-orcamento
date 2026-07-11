// Núcleo PURO da trilha de auditoria de pagamentos.
//
// Em .js (ESM) para ser testável em Node puro (tests.js) e reutilizável pelo
// wrapper de persistência (lib/payment-audit.ts). Sem I/O: apenas normaliza os
// campos essenciais de um evento de pagamento no formato gravado em
// public.payment_audit_log. Nunca lança — sempre devolve um registro válido.

/**
 * Mapeia o status bruto do Mercado Pago para um evento de auditoria estável.
 * @param {string | null | undefined} status
 * @returns {"aprovado" | "pendente" | "rejeitado" | "status_desconhecido"}
 */
export function mapStatusParaEvento(status) {
  switch (String(status ?? "").toLowerCase()) {
    case "approved":
      return "aprovado";
    case "pending":
    case "in_process":
    case "authorized":
      return "pendente";
    case "rejected":
    case "cancelled":
    case "refunded":
    case "charged_back":
      return "rejeitado";
    default:
      return "status_desconhecido";
  }
}

/**
 * Monta o registro de auditoria (só campos essenciais, nada de payload gigante).
 *
 * @param {{
 *   evento?: string,
 *   origem?: string | null,
 *   tenantId?: string | null,
 *   mpPaymentId?: string | number | null,
 *   externalReference?: string | null,
 *   status?: string | null,
 *   valor?: number | string | null,
 *   detalhe?: Record<string, unknown> | null,
 * }} input
 * @returns {{
 *   evento: string, origem: string | null, tenant_id: string | null,
 *   mp_payment_id: string | null, external_reference: string | null,
 *   status: string | null, valor: number | null,
 *   detalhe: Record<string, unknown>,
 * }}
 */
export function construirRegistroAuditoria(input) {
  const src = input ?? {};

  const evento = String(src.evento ?? mapStatusParaEvento(src.status)).trim() ||
    "status_desconhecido";

  const valorNum = Number(src.valor);
  const valor = Number.isFinite(valorNum) ? valorNum : null;

  const detalheBase = src.detalhe && typeof src.detalhe === "object"
    ? src.detalhe
    : {};

  return {
    evento,
    origem: src.origem != null ? String(src.origem) : null,
    tenant_id: src.tenantId != null ? String(src.tenantId) : null,
    mp_payment_id: src.mpPaymentId != null ? String(src.mpPaymentId) : null,
    external_reference:
      src.externalReference != null ? String(src.externalReference) : null,
    status: src.status != null ? String(src.status) : null,
    valor,
    // Só os campos essenciais — nunca o payload inteiro do Mercado Pago.
    detalhe: { ...detalheBase },
  };
}
