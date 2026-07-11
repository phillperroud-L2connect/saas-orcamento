import { createServiceSupabase } from "@/lib/supabase-service";
import { withTimeout } from "@/lib/async";
import { construirRegistroAuditoria } from "@/lib/payment-audit-core";

/**
 * Trilha de auditoria de pagamentos (public.payment_audit_log).
 *
 * Grava um evento relevante do fluxo de pagamento (webhook recebido, status
 * aprovado/pendente/rejeitado) com os campos essenciais para prova em caso de
 * disputa. É BEST-EFFORT e totalmente isolada: qualquer falha é logada e
 * engolida — a auditoria NUNCA pode derrubar o processamento do webhook nem
 * alterar a resposta ao Mercado Pago.
 *
 * A tabela é gravada só pela service role (webhooks). Ver
 * supabase-payment-audit-log.sql.
 */

const AUDIT_TIMEOUT_MS = 5_000;

export type EventoAuditoriaPagamento = {
  evento?: string;
  origem?: "assinatura" | "orcamento" | string | null;
  tenantId?: string | null;
  mpPaymentId?: string | number | null;
  externalReference?: string | null;
  status?: string | null;
  valor?: number | string | null;
  detalhe?: Record<string, unknown> | null;
};

/**
 * Registra um evento de pagamento na trilha de auditoria. Nunca lança.
 * Cria o próprio cliente service-role para poder ser chamada em qualquer ponto
 * do webhook, inclusive antes de o handler instanciar o seu.
 */
export async function registrarEventoPagamento(
  evento: EventoAuditoriaPagamento,
): Promise<void> {
  try {
    const registro = construirRegistroAuditoria(evento);
    const supabase = createServiceSupabase();

    const { error } = await withTimeout(
      supabase.from("payment_audit_log").insert(registro),
      AUDIT_TIMEOUT_MS,
      "gravar payment_audit_log",
    );

    if (error) {
      // Log detalhado no servidor (para depuração), resposta ao MP intocada.
      console.error("[payment-audit] falha ao gravar auditoria:", error);
    }
  } catch (err) {
    console.error("[payment-audit] erro inesperado ao auditar pagamento:", err);
  }
}
