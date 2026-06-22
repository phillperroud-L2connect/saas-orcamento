-- =============================================================================
-- SaaS Gerador de Orçamento — Templates visuais do PDF (migração aditiva)
-- =============================================================================
-- Adiciona a coluna "template" na tabela public.orcamentos para registrar qual
-- modelo visual de PDF foi escolhido ao gerar/salvar o orçamento.
--
-- Valores possíveis:
--   classico -> layout formal, preto e branco (padrão / comportamento atual)
--   moderno  -> cores da marca do tenant, cabeçalho colorido
--   simples  -> layout ultra compacto, sem tabelas
--
-- Script idempotente/aditivo — seguro de rodar mais de uma vez. Orçamentos já
-- existentes recebem 'classico' por causa do DEFAULT.
--
-- Ordem de execução: coluna -> backfill -> constraint de validação.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- COLUNA: template — modelo visual usado no PDF do orçamento
-- -----------------------------------------------------------------------------
alter table public.orcamentos
  add column if not exists template text not null default 'classico';

-- Garante que linhas pré-existentes (caso a coluna já existisse como NULL)
-- fiquem com o valor padrão.
update public.orcamentos
  set template = 'classico'
  where template is null;

-- -----------------------------------------------------------------------------
-- CONSTRAINT: restringe os valores aos três templates suportados
-- (adicionada de forma idempotente — só cria se ainda não existir)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orcamentos_template_check'
  ) then
    alter table public.orcamentos
      add constraint orcamentos_template_check
      check (template in ('classico', 'moderno', 'simples'));
  end if;
end $$;

-- =============================================================================
-- FIM DA MIGRAÇÃO DE TEMPLATES
-- =============================================================================
