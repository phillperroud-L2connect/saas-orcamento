-- =============================================================================
-- SaaS Gerador de Orçamento — Onboarding pós-pagamento com token de acesso
-- Execute UMA VEZ no SQL Editor do Supabase. Script idempotente.
-- =============================================================================
-- Cria a tabela public.onboarding_tokens. Fluxo:
--
--   1. O webhook do Mercado Pago confirma o pagamento e, EM VEZ de criar o
--      tenant na hora, grava aqui um token (uuid) ligado ao e-mail do pagador
--      e ao plano contratado, com validade de 24h.
--   2. O cliente recebe por e-mail (Resend) um link tokenizado:
--          /cadastro?token=<token>
--   3. Na página de cadastro o token é validado (existe, não usado, não
--      expirado); o cliente define a senha; então criamos o usuário no Auth
--      (o trigger on_auth_user_created provisiona tenant + users) e marcamos
--      o token como usado.
--
-- O webhook e a rota /api/cadastro/token usam a SERVICE ROLE (bypassa RLS).
-- A política de RLS abaixo serve apenas para o painel admin LER os tokens.
-- =============================================================================

create table if not exists public.onboarding_tokens (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  -- Token único enviado no link de cadastro. Default só por conveniência:
  -- o webhook gera o uuid no servidor e insere explicitamente.
  token       uuid not null unique default gen_random_uuid(),
  plano       text not null check (plano in ('basico', 'pro')),
  -- Periodicidade contratada — define o vencimento na criação da conta
  -- (+1 mês para 'mensal', +12 meses para 'anual').
  periodo     text not null default 'mensal' check (periodo in ('mensal', 'anual')),
  -- País da conta que assinou — carrega até o provisionamento em
  -- /api/cadastro/token, definindo pais/idioma/moeda do tenant (AR → es/ARS,
  -- BR → pt/BRL). Default 'AR' preserva o comportamento legado.
  pais        text not null default 'AR' check (pais in ('AR', 'BR')),
  usado       boolean not null default false,
  criado_em   timestamptz not null default now(),
  -- Expira 24h após a criação. Validado também na aplicação.
  expira_em   timestamptz not null default (now() + interval '24 hours')
);

-- Migração para bancos que já tinham a tabela antes da coluna `periodo`.
alter table public.onboarding_tokens
  add column if not exists periodo text not null default 'mensal'
    check (periodo in ('mensal', 'anual'));

-- Migração para bancos que já tinham a tabela antes da coluna `pais` (multi-país
-- AR/BR). Default 'AR' marca tokens legados como argentinos, sem quebrar dados.
alter table public.onboarding_tokens
  add column if not exists pais text not null default 'AR'
    check (pais in ('AR', 'BR'));

create index if not exists idx_onboarding_tokens_token on public.onboarding_tokens (token);
create index if not exists idx_onboarding_tokens_email on public.onboarding_tokens (email);

-- -----------------------------------------------------------------------------
-- RLS: a aplicação opera via SERVICE ROLE (bypassa RLS). A política abaixo
-- libera apenas a LEITURA para o e-mail do dono do SaaS (painel admin),
-- mantendo o mesmo padrão de public.assinaturas.
-- -----------------------------------------------------------------------------
alter table public.onboarding_tokens enable row level security;

drop policy if exists onboarding_tokens_admin_all on public.onboarding_tokens;
create policy onboarding_tokens_admin_all on public.onboarding_tokens
  for all
  to authenticated
  using ((auth.jwt() ->> 'email') = 'phillperroud@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'phillperroud@gmail.com');

-- =============================================================================
-- FIM
-- =============================================================================
