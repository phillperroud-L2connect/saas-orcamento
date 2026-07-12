-- =============================================================================
-- SaaS Gerador de Orçamento — Moeda por registro de assinatura (AR / BR)
-- Execute UMA VEZ no SQL Editor do Supabase. Idempotente (pode rodar de novo).
-- =============================================================================
-- Contexto:
--   A tabela public.assinaturas guardava só o `valor` numérico, sem a moeda.
--   O painel admin formatava TUDO como ARS (hardcoded), então pagamentos
--   brasileiros em BRL apareciam como pesos argentinos. Esta coluna registra a
--   moeda de cada pagamento na origem (webhook / lançamento manual), permitindo
--   ao admin exibir cada linha na moeda correta.
--
--   Default 'ARS': todo registro anterior ao Brasil era argentino, então o
--   default já classifica corretamente o histórico existente — sem migração
--   retroativa de dados.
-- =============================================================================

alter table public.assinaturas
  add column if not exists moeda text not null default 'ARS'
    check (moeda in ('ARS', 'BRL'));

-- =============================================================================
-- FIM
-- =============================================================================
