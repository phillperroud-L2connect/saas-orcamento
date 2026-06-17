-- =============================================================================
-- SaaS Gerador de Orçamento — Etapa 2
-- Schema multi-tenant com RLS Compartilhado (Shared Database / Shared Schema)
-- =============================================================================
-- Modelo de isolamento: todas as tabelas carregam tenant_id e o RLS garante
-- que cada usuário autenticado só enxergue/manipule linhas do seu próprio tenant.
--
-- Pré-requisitos: extensão pgcrypto (gen_random_uuid) e o schema auth do Supabase.
--
-- Ordem de execução: extensão -> tabelas -> função helper -> índices -> RLS
-- -> políticas. A função current_tenant_id() é criada DEPOIS da tabela users,
-- pois funções "language sql" têm o corpo validado no momento da criação.
-- =============================================================================

create extension if not exists "pgcrypto";

-- =============================================================================
-- TABELA: tenants — clientes do SaaS
-- =============================================================================
create table if not exists public.tenants (
  id                uuid primary key default gen_random_uuid(),
  nome_empresa      text not null,
  nome_profissional text,
  email             text not null,
  telefone          text,
  logo_url          text,
  cor_primaria      text default '#000000',
  pais              text not null default 'BR' check (pais in ('BR', 'AR')),
  idioma            text not null default 'pt' check (idioma in ('pt', 'es')),
  ativo             boolean not null default true,
  created_at        timestamptz not null default now()
);

-- =============================================================================
-- TABELA: users — usuários de cada tenant
-- id referencia auth.users(id) do Supabase Auth
-- =============================================================================
create table if not exists public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  email      text not null,
  nome       text,
  role       text not null default 'user' check (role in ('admin', 'user')),
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- TABELA: clientes — clientes de cada usuário do sistema
-- =============================================================================
create table if not exists public.clientes (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  nome       text not null,
  email      text,
  telefone   text,
  endereco   text,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- TABELA: orcamentos — orçamentos gerados
-- =============================================================================
create table if not exists public.orcamentos (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  user_id             uuid references public.users(id) on delete set null,
  cliente_id          uuid references public.clientes(id) on delete set null,
  numero              text,
  titulo              text,
  itens               jsonb not null default '[]'::jsonb,
  subtotal            numeric(12,2) not null default 0,
  desconto            numeric(12,2) not null default 0,
  total               numeric(12,2) not null default 0,
  moeda               text not null default 'BRL' check (moeda in ('BRL', 'ARS', 'USD')),
  status              text not null default 'rascunho'
                        check (status in ('rascunho', 'enviado', 'aprovado', 'recusado')),
  opcao_pagamento     text default 'unico'
                        check (opcao_pagamento in ('unico', 'entrada_restante', 'parcelado')),
  parcelas            integer default 1,
  percentual_entrada  numeric(5,2) default 0,
  created_at          timestamptz not null default now()
);

-- =============================================================================
-- TABELA: pagamentos — pagamentos gerados via Mercado Pago
-- =============================================================================
create table if not exists public.pagamentos (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  orcamento_id   uuid references public.orcamentos(id) on delete cascade,
  tipo           text not null check (tipo in ('total', 'entrada', 'restante', 'parcela')),
  numero_parcela integer,
  valor          numeric(12,2) not null default 0,
  status         text not null default 'pendente',
  link_pagamento text,
  qr_code        text,
  created_at     timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Helper: retorna o tenant_id do usuário autenticado atual.
-- Criada DEPOIS da tabela users (o corpo SQL referencia public.users).
-- Faz o vínculo entre auth.uid() (Supabase Auth) e a tabela public.users.
-- SECURITY DEFINER evita recursão de RLS ao ler public.users dentro das policies.
-- -----------------------------------------------------------------------------
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.users where id = auth.uid();
$$;

-- =============================================================================
-- ÍNDICES — coluna tenant_id em todas as tabelas (+ FKs mais consultadas)
-- =============================================================================
create index if not exists idx_users_tenant_id        on public.users (tenant_id);
create index if not exists idx_clientes_tenant_id      on public.clientes (tenant_id);
create index if not exists idx_orcamentos_tenant_id    on public.orcamentos (tenant_id);
create index if not exists idx_orcamentos_cliente_id   on public.orcamentos (cliente_id);
create index if not exists idx_orcamentos_user_id      on public.orcamentos (user_id);
create index if not exists idx_pagamentos_tenant_id    on public.pagamentos (tenant_id);
create index if not exists idx_pagamentos_orcamento_id on public.pagamentos (orcamento_id);

-- =============================================================================
-- ROW LEVEL SECURITY — habilitar em todas as tabelas
-- =============================================================================
alter table public.tenants    enable row level security;
alter table public.users      enable row level security;
alter table public.clientes   enable row level security;
alter table public.orcamentos enable row level security;
alter table public.pagamentos enable row level security;

-- -----------------------------------------------------------------------------
-- POLÍTICAS RLS
-- Cada tenant só acessa seus próprios dados via tenant_id = current_tenant_id().
-- WITH CHECK garante que inserts/updates não escapem do tenant do usuário.
-- -----------------------------------------------------------------------------

-- tenants: o usuário só enxerga/edita o registro do próprio tenant
drop policy if exists tenants_isolation on public.tenants;
create policy tenants_isolation on public.tenants
  for all
  using (id = public.current_tenant_id())
  with check (id = public.current_tenant_id());

-- users
drop policy if exists users_isolation on public.users;
create policy users_isolation on public.users
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- clientes
drop policy if exists clientes_isolation on public.clientes;
create policy clientes_isolation on public.clientes
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- orcamentos
drop policy if exists orcamentos_isolation on public.orcamentos;
create policy orcamentos_isolation on public.orcamentos
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- pagamentos
drop policy if exists pagamentos_isolation on public.pagamentos;
create policy pagamentos_isolation on public.pagamentos
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- =============================================================================
-- FIM DO SCHEMA
-- =============================================================================
