-- =============================================================================
-- SaaS Gerador de Orçamento — Etapa 2: entrega recuperável do onboarding
-- Execute UMA VEZ no SQL Editor do Supabase. Script idempotente.
-- =============================================================================
-- Acrescenta a coluna `email_enviado_em` em public.onboarding_tokens.
--
-- POR QUÊ: hoje o e-mail de ativação é best-effort — se a entrega falha, o
-- webhook mesmo assim responde 200 e o cliente fica pago sem link. A partir da
-- Etapa 2 o webhook (e o reenvio) só considera o onboarding ENTREGUE quando o
-- Resend confirma o envio, carimbando aqui a data/hora. Enquanto `email_enviado_em`
-- for NULL, a retentativa do Mercado Pago (ou o reenvio manual/self-serve) pode
-- regenerar o token e reenviar o e-mail — SEM tocar no pagamento, que continua
-- idempotente via assinaturas.mp_payment_id (UNIQUE, inalterado).
--
-- NULL = ainda não entregue (precisa (re)enviar).
-- preenchido = Resend confirmou o envio (não reenviar; evita spam).
--
-- IMPORTANTE: rode esta migração ANTES de publicar o código da Etapa 2 — o
-- webhook passa a ler/gravar esta coluna. Rodar em banco sem o código é inócuo
-- (a coluna só fica nula).
-- =============================================================================

alter table public.onboarding_tokens
  add column if not exists email_enviado_em timestamptz;

-- =============================================================================
-- FIM
-- =============================================================================
