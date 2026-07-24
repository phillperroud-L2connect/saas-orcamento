-- =============================================================================
-- SaaS Gerador de Orçamento — Templates premium do Plano Max (migração aditiva)
-- Execute UMA VEZ no SQL Editor do Supabase. Script idempotente.
-- =============================================================================
-- Habilita no banco os três templates visuais premium do segmento web designer,
-- exclusivos do novo plano "max":
--
--   1. tenants.plano                 — passa a aceitar também 'max'.
--   2. tenants.paleta_templates      — nova coluna jsonb com os overrides de
--      cor por template/token (ver lib/templates-core.js). Ausente/null = usa
--      as paletas padrão embutidas no código.
--   3. orcamentos.template           — a constraint de valores é RELAXADA para
--      não barrar ids futuros; a validação de qual template cada plano pode
--      usar mora na aplicação (podeUsarTemplate/resolverTemplate), que é onde o
--      gating por plano é aplicado de forma testável.
--
-- Aditivo e seguro de rodar mais de uma vez. Não altera dados existentes:
-- tenants continuam com seu plano atual e paleta_templates nasce NULL (paletas
-- padrão), orçamentos antigos mantêm o template gravado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PLANO — aceitar 'max' (mantém 'basico' | 'pro' | 'manual' | null).
-- -----------------------------------------------------------------------------
alter table public.tenants drop constraint if exists tenants_plano_check;
alter table public.tenants
  add constraint tenants_plano_check
  check (plano is null or plano in ('basico', 'pro', 'max', 'manual'));

-- Espelha na tabela de histórico de cobranças, por consistência (o admin pode
-- registrar uma cobrança manual de um assinante Max).
alter table public.assinaturas drop constraint if exists assinaturas_plano_check;
alter table public.assinaturas
  add constraint assinaturas_plano_check
  check (plano in ('basico', 'pro', 'max', 'manual'));

-- -----------------------------------------------------------------------------
-- 2. PALETA DOS TEMPLATES — overrides de cor por template/token (jsonb).
--    Ex.: {"atelier_noir": {"dourado": "#d4b57a", "vinho": "#5c1a2b"}}
--    Só os tokens editáveis de cada template são lidos; o resto é derivado no
--    código com garantia de contraste. Chaves/valores inválidos são ignorados
--    pela aplicação (paletaEfetiva), então não há CHECK de forma aqui.
-- -----------------------------------------------------------------------------
alter table public.tenants
  add column if not exists paleta_templates jsonb;

-- -----------------------------------------------------------------------------
-- 3. TEMPLATE DO ORÇAMENTO — relaxar a constraint de valores.
--    Antes: check in ('classico','moderno','simples'). Passa a aceitar também
--    os três premium. Mantida como allowlist (em vez de removida) para barrar
--    lixo, mas a decisão de acesso por plano é da aplicação, não do banco.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'orcamentos_template_check'
  ) then
    alter table public.orcamentos drop constraint orcamentos_template_check;
  end if;

  alter table public.orcamentos
    add constraint orcamentos_template_check
    check (template in (
      'classico', 'moderno', 'simples',
      'atelier_noir', 'blueprint_tecnico', 'swiss_studio'
    ));
end $$;

-- =============================================================================
-- FIM DA MIGRAÇÃO DE TEMPLATES PREMIUM
-- =============================================================================
