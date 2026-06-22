-- =============================================================================
-- SaaS Gerador de Orçamento — Arquivamento de orçamentos (idempotente / aditivo)
-- =============================================================================
-- Adiciona o status 'arquivado' à coluna public.orcamentos.status.
--
-- A definição original (supabase-schema.sql) restringe o status via CHECK a
-- ('rascunho', 'enviado', 'aprovado', 'recusado'). Sem este script, qualquer
-- UPDATE para status = 'arquivado' falha com violação de check constraint.
--
-- A constraint inline gerada pelo Postgres recebe o nome padrão
-- "orcamentos_status_check"; aqui ela é derrubada e recriada incluindo
-- 'arquivado'. Seguro de reaplicar (drop ... if exists).
--
-- Não altera RLS, FKs nem dados existentes.
-- =============================================================================

alter table public.orcamentos
  drop constraint if exists orcamentos_status_check;

alter table public.orcamentos
  add constraint orcamentos_status_check
  check (status in ('rascunho', 'enviado', 'aprovado', 'recusado', 'arquivado'));

-- =============================================================================
-- FIM
-- =============================================================================
