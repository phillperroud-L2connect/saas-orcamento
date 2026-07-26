-- =============================================================================
-- SaaS Gerador de Orçamento — "Esconder blocos" do Plano Max (migração aditiva)
-- Execute UMA VEZ no SQL Editor do Supabase. Script idempotente.
-- =============================================================================
-- Adiciona a coluna que guarda, por orçamento, quais blocos (seções) o tenant
-- Max escolheu OCULTAR naquele documento. A feature só esconde/mostra — nunca
-- reordena nem duplica —, então basta uma lista simples de ids de bloco.
--
--   orcamentos.blocos_ocultos  — jsonb, um array de ids de bloco a esconder.
--                                Ex.: ["nota", "pagar_online"]. Os ids válidos
--                                por template moram em lib/blocos-core.js
--                                (BLOCOS_TEMPLATE); ids desconhecidos são
--                                ignorados pela aplicação, então não há CHECK de
--                                conteúdo aqui.
--
-- Aditivo e seguro de rodar mais de uma vez. NÃO altera dados existentes: a
-- coluna nasce NULL em todos os orçamentos e NULL/`[]` significa "documento
-- completo", ou seja, exatamente o comportamento atual. Nenhum orçamento antigo
-- muda de aparência.
-- =============================================================================

alter table public.orcamentos
  add column if not exists blocos_ocultos jsonb;

-- =============================================================================
-- FIM DA MIGRAÇÃO DE "ESCONDER BLOCOS"
-- =============================================================================
