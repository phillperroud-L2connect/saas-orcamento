-- =============================================================================
-- SaaS Gerador de Orçamento — Mercado Pago do USUÁRIO (prestador de serviço)
-- Execute UMA VEZ no SQL Editor do Supabase. Script idempotente.
-- =============================================================================
-- Permite que cada tenant (prestador) conecte a PRÓPRIA conta do Mercado Pago
-- via OAuth, para receber os pagamentos dos clientes finais direto na sua conta.
--
-- Diferença em relação ao MP_ACCESS_TOKEN do .env.local:
--   • MP_ACCESS_TOKEN (.env)   -> conta do DONO do SaaS (cobra as assinaturas).
--   • tenants.mp_access_token  -> conta de CADA prestador (recebe dos clientes).
--
-- Colunas:
--   • mp_access_token  — access_token OAuth da conta MP do prestador (privado).
--   • mp_user_id       — id do usuário Mercado Pago do prestador (collector id).
--   • mp_refresh_token — refresh_token OAuth (renova o access_token quando expira).
--   • mp_email         — e-mail da conta MP conectada (exibido no painel).
-- =============================================================================

-- 1. ACCESS TOKEN da conta MP do prestador (obrigatório p/ criar cobranças).
alter table public.tenants
  add column if not exists mp_access_token text;

-- 2. USER ID (collector id) da conta MP do prestador.
alter table public.tenants
  add column if not exists mp_user_id text;

-- 3. REFRESH TOKEN — renova o access_token sem novo OAuth.
alter table public.tenants
  add column if not exists mp_refresh_token text;

-- 4. E-MAIL da conta MP conectada — mostrado como "Mercado Pago conectado (email)".
alter table public.tenants
  add column if not exists mp_email text;

-- =============================================================================
-- FIM
-- =============================================================================
