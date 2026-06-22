-- =============================================================================
-- SaaS Gerador de Orçamento — Modelos de orçamento (templates reutilizáveis)
-- =============================================================================
-- Cria a tabela public.modelos_orcamento com isolamento multi-tenant via RLS.
--
-- Um modelo guarda apenas a parte REUTILIZÁVEL de um orçamento — itens/serviços,
-- forma de pagamento e observações — SEM nenhum dado de cliente. Ao carregar um
-- modelo no formulário, esses campos são pré-preenchidos e o usuário só completa
-- os dados do cliente.
--
-- Estrutura dos campos jsonb:
--   itens     -> array de { "descricao": text, "valor": number }
--   pagamento -> objeto com os campos de pagamento do formulário:
--                { opcao_pagamento, percentual_entrada, parcelas,
--                  tipo_parcelamento, entrada_tipo, entrada_valor }
--
-- Reaproveita o helper public.current_tenant_id() (criado em supabase-schema.sql),
-- que vincula auth.uid() -> public.users.tenant_id.
--
-- Pré-requisitos: pgcrypto, tabelas public.tenants e public.users, e a função
-- public.current_tenant_id() já aplicadas. Script idempotente/aditivo.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- TABELA: modelos_orcamento — templates de orçamento por tenant
-- -----------------------------------------------------------------------------
create table if not exists public.modelos_orcamento (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid references public.users(id) on delete set null,
  nome        text not null,
  itens       jsonb not null default '[]'::jsonb,
  pagamento   jsonb not null default '{}'::jsonb,
  observacoes text,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- ÍNDICES — busca por tenant e ordenação por nome
-- -----------------------------------------------------------------------------
create index if not exists idx_modelos_orcamento_tenant_id
  on public.modelos_orcamento (tenant_id);
create index if not exists idx_modelos_orcamento_nome
  on public.modelos_orcamento (lower(nome));

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY — cada tenant só vê os próprios modelos
-- -----------------------------------------------------------------------------
alter table public.modelos_orcamento enable row level security;

-- WITH CHECK garante que inserts/updates não escapem do tenant do usuário.
drop policy if exists modelos_orcamento_isolation on public.modelos_orcamento;
create policy modelos_orcamento_isolation on public.modelos_orcamento
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- =============================================================================
-- FIM DO MÓDULO DE MODELOS
-- =============================================================================
