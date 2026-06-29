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
  usado       boolean not null default false,
  criado_em   timestamptz not null default now(),
  -- Expira 24h após a criação. Validado também na aplicação.
  expira_em   timestamptz not null default (now() + interval '24 hours')
);

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
