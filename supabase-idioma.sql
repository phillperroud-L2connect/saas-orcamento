-- SaaS Gerador de Orçamento — Migração: Idioma e Moeda por tenant
-- Execute UMA VEZ no SQL Editor do Supabase (Dashboard > SQL Editor > New query).
--
-- Contexto: o idioma do app do tenant e a moeda dos orçamentos passam a ser
-- definidos pelo admin na criação/edição do tenant.
--   - Português (pt) -> moeda fixa BRL (R$)
--   - Español   (es) -> moeda escolhida: ARS (peso argentino) ou USD (dólar)
--
-- O script é idempotente: pode rodar mais de uma vez sem efeitos colaterais.
-- (As colunas `idioma` e `moeda_preferida` podem já existir de migrações
-- anteriores — supabase-schema.sql e supabase-admin.sql; os ADD ... IF NOT
-- EXISTS apenas garantem a presença em bancos criados antes desta etapa.)

-- 1. Coluna de idioma do app do tenant (pt | es). Default 'pt'.
alter table public.tenants
  add column if not exists idioma text not null default 'pt';

-- Garante a restrição de valores válidos (recriada de forma idempotente).
alter table public.tenants
  drop constraint if exists tenants_idioma_check;
alter table public.tenants
  add constraint tenants_idioma_check check (idioma in ('pt', 'es'));

-- 2. Coluna de moeda preferida (BRL | ARS | USD). Usada pelo app/PDF do tenant.
alter table public.tenants
  add column if not exists moeda_preferida text;

alter table public.tenants
  drop constraint if exists tenants_moeda_preferida_check;
alter table public.tenants
  add constraint tenants_moeda_preferida_check
    check (moeda_preferida in ('BRL', 'ARS', 'USD'));

-- 3. Backfill: tenants em português sem moeda definida passam a usar BRL.
update public.tenants
  set moeda_preferida = 'BRL'
  where idioma = 'pt' and moeda_preferida is null;

-- 4. Backfill defensivo: tenants em espanhol sem moeda assumem ARS por padrão.
update public.tenants
  set moeda_preferida = 'ARS'
  where idioma = 'es' and moeda_preferida is null;
