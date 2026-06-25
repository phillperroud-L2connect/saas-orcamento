-- =============================================================================
-- SaaS Gerador de Orçamento — Controle completo de assinantes (Painel Admin)
-- Execute UMA VEZ no SQL Editor do Supabase. Script idempotente.
-- =============================================================================
-- Adiciona ao tenant os campos de controle de assinatura usados pelo admin:
--   • ativo            — libera/bloqueia o acesso da empresa (controle de acesso)
--   • status_assinatura — pago | pendente | inadimplente (badge colorido)
--   • plano            — passa a aceitar também "manual" (pagamento fora do MP)
--   • forma_pagamento  — mercado_pago | transferencia | dinheiro
--   • vencimento       — data de vencimento da assinatura
-- E amplia a tabela de histórico `assinaturas` para registrar cobranças manuais.
-- =============================================================================

-- 1. ACESSO — coluna `ativo` (já existe no schema base; reforçada aqui).
alter table public.tenants
  add column if not exists ativo boolean not null default true;

-- 2. STATUS DA ASSINATURA — pago / pendente / inadimplente.
alter table public.tenants
  add column if not exists status_assinatura text not null default 'pendente';

alter table public.tenants drop constraint if exists tenants_status_assinatura_check;
alter table public.tenants
  add constraint tenants_status_assinatura_check
  check (status_assinatura in ('pago', 'pendente', 'inadimplente'));

-- 3. FORMA DE PAGAMENTO.
alter table public.tenants
  add column if not exists forma_pagamento text;

alter table public.tenants drop constraint if exists tenants_forma_pagamento_check;
alter table public.tenants
  add constraint tenants_forma_pagamento_check
  check (forma_pagamento is null
         or forma_pagamento in ('mercado_pago', 'transferencia', 'dinheiro'));

-- 4. DATA DE VENCIMENTO.
alter table public.tenants
  add column if not exists vencimento date;

-- 5. PLANO — passa a aceitar "manual" (clientes que pagam fora do Mercado Pago).
alter table public.tenants drop constraint if exists tenants_plano_check;
alter table public.tenants
  add constraint tenants_plano_check
  check (plano is null or plano in ('basico', 'pro', 'manual'));

-- 6. HISTÓRICO (assinaturas) — registra a forma de pagamento e aceita "manual".
alter table public.assinaturas
  add column if not exists forma_pagamento text not null default 'mercado_pago';

alter table public.assinaturas drop constraint if exists assinaturas_plano_check;
alter table public.assinaturas
  add constraint assinaturas_plano_check
  check (plano in ('basico', 'pro', 'manual'));

-- 7. BACKFILL — tenants que já têm venda aprovada no histórico viram "pago".
update public.tenants t
set status_assinatura = 'pago',
    forma_pagamento    = coalesce(t.forma_pagamento, 'mercado_pago')
where exists (
  select 1 from public.assinaturas a
  where a.tenant_id = t.id and a.status = 'approved'
);

-- =============================================================================
-- FIM
-- =============================================================================
