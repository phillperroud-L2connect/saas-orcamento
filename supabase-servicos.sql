-- =============================================================================
-- SaaS Gerador de Orçamento — Catálogo de Serviços ("Meus Serviços")
-- =============================================================================
-- Cria a tabela public.servicos com isolamento multi-tenant via RLS.
--
-- Um serviço é um item reutilizável do catálogo do tenant — apenas um nome e um
-- preço padrão. No formulário de orçamento o usuário pode selecionar um serviço
-- cadastrado para pré-preencher a descrição e o valor de uma linha, sem precisar
-- redigitar.
--
-- Reaproveita o helper public.current_tenant_id() (criado em supabase-schema.sql),
-- que vincula auth.uid() -> public.users.tenant_id.
--
-- Pré-requisitos: pgcrypto (gen_random_uuid), tabelas public.tenants e
-- public.users, e a função public.current_tenant_id() já aplicadas.
-- Script idempotente/aditivo — seguro de rodar mais de uma vez.
--
-- Ordem de execução: extensão -> tabela -> índices -> RLS -> política.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- TABELA: servicos — catálogo de serviços por tenant
-- -----------------------------------------------------------------------------
create table if not exists public.servicos (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid references public.users(id) on delete set null,
  nome       text not null,
  preco      numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- ÍNDICES — busca por tenant e ordenação por nome
-- -----------------------------------------------------------------------------
create index if not exists idx_servicos_tenant_id on public.servicos (tenant_id);
-- Índice em nome com lower() para ordenação/busca case-insensitive eficiente.
create index if not exists idx_servicos_nome       on public.servicos (lower(nome));

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY — cada tenant só vê os próprios serviços
-- -----------------------------------------------------------------------------
alter table public.servicos enable row level security;

-- WITH CHECK garante que inserts/updates não escapem do tenant do usuário.
drop policy if exists servicos_isolation on public.servicos;
create policy servicos_isolation on public.servicos
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- =============================================================================
-- FIM DO MÓDULO DE SERVIÇOS
-- =============================================================================
