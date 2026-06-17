-- =============================================================================
-- SaaS Gerador de Orçamento — Etapa 6: Painel Admin
-- =============================================================================
-- Execute este script UMA VEZ no SQL Editor do Supabase
-- (Dashboard -> SQL Editor -> New query -> colar -> Run).
--
-- Ele faz três coisas:
--   1. Adiciona a coluna tenants.moeda_preferida (usada quando país = AR)
--   2. Cria políticas RLS que liberam a tabela tenants INTEIRA para o admin
--   3. Cria o bucket de Storage "logos" e suas políticas de acesso
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Coluna de moeda preferida (BR usa BRL implícito; AR escolhe ARS ou USD)
-- -----------------------------------------------------------------------------
alter table public.tenants
  add column if not exists moeda_preferida text
    check (moeda_preferida in ('BRL', 'ARS', 'USD'));

-- -----------------------------------------------------------------------------
-- 2. RLS: acesso total à tabela tenants apenas para o e-mail do dono do SaaS.
--    Políticas permissivas são combinadas com OR — esta convive com a
--    tenants_isolation existente (cada usuário continua vendo só o seu tenant).
-- -----------------------------------------------------------------------------
drop policy if exists tenants_admin_all on public.tenants;
create policy tenants_admin_all on public.tenants
  for all
  to authenticated
  using ((auth.jwt() ->> 'email') = 'phillperroud@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'phillperroud@gmail.com');

-- -----------------------------------------------------------------------------
-- 3. Storage: bucket público "logos" para as imagens das marcas.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do update set public = true;

-- Leitura pública (os logos aparecem nos orçamentos / PDFs via URL pública).
drop policy if exists logos_public_read on storage.objects;
create policy logos_public_read on storage.objects
  for select
  using (bucket_id = 'logos');

-- Apenas o admin pode enviar / atualizar / remover logos.
drop policy if exists logos_admin_write on storage.objects;
create policy logos_admin_write on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'logos'
    and (auth.jwt() ->> 'email') = 'phillperroud@gmail.com'
  )
  with check (
    bucket_id = 'logos'
    and (auth.jwt() ->> 'email') = 'phillperroud@gmail.com'
  );

-- =============================================================================
-- FIM
-- =============================================================================
