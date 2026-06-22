-- =============================================================================
-- SaaS Gerador de Orçamento — Módulo de Clientes (idempotente / aditivo)
-- =============================================================================
-- Cria/normaliza a tabela public.clientes com isolamento multi-tenant via RLS.
--
-- IMPORTANTE: a tabela "clientes" pode já existir (criada no supabase-schema.sql,
-- porém com menos colunas). Por isso este script é seguro de aplicar nos dois
-- cenários:
--   * tabela inexistente  -> "create table if not exists" cria completa;
--   * tabela já existente  -> "alter table ... add column if not exists" apenas
--     acrescenta as colunas que faltam (user_id, documento, updated_at).
--
-- Reaproveita o helper public.current_tenant_id() do schema multi-tenant
-- (vincula auth.uid() -> public.users.tenant_id). Esse helper deve existir;
-- ele é criado em supabase-schema.sql.
--
-- Pré-requisitos: pgcrypto (gen_random_uuid), tabelas public.tenants e
-- public.users, e a função public.current_tenant_id() já aplicadas.
--
-- Ordem de execução: extensão -> tabela -> colunas -> índices -> RLS
-- -> política -> trigger de updated_at.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- TABELA: clientes — clientes de cada tenant
-- -----------------------------------------------------------------------------
create table if not exists public.clientes (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid references public.users(id) on delete set null,
  nome       text not null,
  email      text,
  telefone   text,
  documento  text,
  endereco   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Acrescenta as colunas que faltam quando a tabela já existia (schema antigo).
alter table public.clientes
  add column if not exists user_id    uuid references public.users(id) on delete set null;
alter table public.clientes
  add column if not exists documento  text;
alter table public.clientes
  add column if not exists updated_at timestamptz not null default now();

-- -----------------------------------------------------------------------------
-- ÍNDICES — busca rápida por tenant e por nome
-- -----------------------------------------------------------------------------
create index if not exists idx_clientes_tenant_id on public.clientes (tenant_id);
-- Índice em nome com lower() para busca case-insensitive eficiente.
create index if not exists idx_clientes_nome       on public.clientes (lower(nome));

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY — cada tenant só vê os próprios clientes
-- -----------------------------------------------------------------------------
alter table public.clientes enable row level security;

-- WITH CHECK garante que inserts/updates não escapem do tenant do usuário.
drop policy if exists clientes_isolation on public.clientes;
create policy clientes_isolation on public.clientes
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- -----------------------------------------------------------------------------
-- TRIGGER: atualiza updated_at automaticamente a cada UPDATE
-- Função genérica e reutilizável (set_updated_at) — só (re)cria a si mesma.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_clientes_updated_at on public.clientes;
create trigger trg_clientes_updated_at
  before update on public.clientes
  for each row
  execute function public.set_updated_at();

-- =============================================================================
-- FIM DO MÓDULO DE CLIENTES
-- =============================================================================
