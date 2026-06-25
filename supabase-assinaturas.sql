-- =============================================================================
-- SaaS Gerador de Orçamento — Checkout Mercado Pago (Argentina)
-- Execute UMA VEZ no SQL Editor do Supabase.
-- =============================================================================
-- Cria:
--   1. Coluna tenants.plano  — qual plano o cliente comprou (basico/pro)
--   2. Tabela public.assinaturas — log das vendas confirmadas via Mercado Pago,
--      usada para idempotência do webhook e visibilidade no painel admin.
-- =============================================================================

-- 1. Plano contratado pelo tenant (NULL = tenants antigos / criados manualmente)
alter table public.tenants
  add column if not exists plano text
    check (plano in ('basico', 'pro'));


-- 2. Registro de cada pagamento aprovado vindo do Mercado Pago.
create table if not exists public.assinaturas (
  id                uuid primary key default gen_random_uuid(),
  -- ID do pagamento no Mercado Pago. UNIQUE garante idempotência: se o webhook
  -- for chamado mais de uma vez para o mesmo pagamento, o segundo insert falha.
  mp_payment_id     text not null unique,
  mp_preference_id  text,
  external_reference text,
  plano             text not null check (plano in ('basico', 'pro')),
  nome              text,
  email             text not null,
  whatsapp          text,
  valor             numeric(12,2),
  status            text not null default 'approved',
  tenant_id         uuid references public.tenants(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists idx_assinaturas_email     on public.assinaturas (email);
create index if not exists idx_assinaturas_tenant_id on public.assinaturas (tenant_id);


-- 3. RLS: o webhook usa a SERVICE ROLE (bypassa RLS). A política abaixo serve
-- só para o painel admin conseguir LER as vendas com a sessão autenticada.
alter table public.assinaturas enable row level security;

drop policy if exists assinaturas_admin_all on public.assinaturas;
create policy assinaturas_admin_all on public.assinaturas
  for all
  to authenticated
  using ((auth.jwt() ->> 'email') = 'phillperroud@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'phillperroud@gmail.com');

-- =============================================================================
-- FIM
-- =============================================================================
