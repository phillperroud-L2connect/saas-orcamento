-- SaaS Gerador de Orcamento - Etapa 6: Painel Admin
-- Execute este script UMA VEZ no SQL Editor do Supabase
-- (Dashboard > SQL Editor > New query > colar > Run).
--
-- Ele faz tres coisas:
--   1. Adiciona a coluna tenants.moeda_preferida (usada quando pais = AR)
--   2. Cria politicas RLS que liberam a tabela tenants inteira para o admin
--   3. Cria o bucket de Storage "logos" e suas politicas de acesso


-- 1. Coluna de moeda preferida (BR usa BRL implicito; AR escolhe ARS ou USD)
alter table public.tenants
  add column if not exists moeda_preferida text
    check (moeda_preferida in ('BRL', 'ARS', 'USD'));


-- 2. RLS: acesso total a tabela tenants apenas para o e-mail do dono do SaaS.
-- Politicas permissivas sao combinadas com OR, entao esta convive com a
-- tenants_isolation existente (cada usuario continua vendo so o seu tenant).
drop policy if exists tenants_admin_all on public.tenants;
create policy tenants_admin_all on public.tenants
  for all
  to authenticated
  using ((auth.jwt() ->> 'email') = 'phillperroud@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'phillperroud@gmail.com');


-- 3. Storage: bucket publico "logos" para as imagens das marcas.
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do update set public = true;

-- Leitura publica (os logos aparecem nos orcamentos / PDFs via URL publica).
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
