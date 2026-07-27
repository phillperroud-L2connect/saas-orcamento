-- =============================================================================
-- SaaS Gerador de Orçamento — Reversão do plano "max" (migração aditiva/segura)
-- Execute UMA VEZ no SQL Editor do Supabase. Script idempotente.
-- =============================================================================
-- Decisão de produto: voltamos a ter SÓ DOIS planos vendáveis — 'basico' e 'pro'
-- (+ o status 'manual' = pagamento fora do Mercado Pago). O antigo 'max' deixa de
-- existir; toda a funcionalidade premium (templates atelier_noir / blueprint_tecnico
-- / swiss_studio e a reorganização de blocos) passa a ser exclusiva do 'pro', que
-- é o mais caro dos dois. O gating mora na aplicação (podeUsarTemplate/resolverTemplate
-- em lib/templates-core.js), que já foi ajustado para exigir 'pro'.
--
-- Esta migração apenas REMOVE 'max' das constraints de valor. É segura porque a
-- verificação em produção (antes da mudança) encontrou ZERO linhas com plano='max'
-- em tenants e em assinaturas — nenhum dado precisa ser migrado. Se, por algum
-- motivo, existir uma linha 'max' quando você rodar isto, o ALTER vai FALHAR (a
-- constraint não valida) em vez de corromper nada: nesse caso, reclassifique a
-- linha para 'pro' antes de reexecutar.
--
-- NÃO mexe na constraint de orcamentos.template: os três templates premium
-- continuam sendo valores válidos (agora liberados via 'pro'), então a allowlist
-- de templates permanece intacta.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PLANO (tenants) — voltar a aceitar só 'basico' | 'pro' | 'manual' | null.
-- -----------------------------------------------------------------------------
alter table public.tenants drop constraint if exists tenants_plano_check;
alter table public.tenants
  add constraint tenants_plano_check
  check (plano is null or plano in ('basico', 'pro', 'manual'));

-- -----------------------------------------------------------------------------
-- 2. PLANO (assinaturas) — espelha o histórico de cobranças, sem 'max'.
-- -----------------------------------------------------------------------------
alter table public.assinaturas drop constraint if exists assinaturas_plano_check;
alter table public.assinaturas
  add constraint assinaturas_plano_check
  check (plano in ('basico', 'pro', 'manual'));

-- =============================================================================
-- FIM DA REVERSÃO DO PLANO MAX
-- =============================================================================
