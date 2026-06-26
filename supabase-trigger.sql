-- =============================================================================
-- SaaS Gerador de Orçamento — Etapa 3 (provisionamento de novos usuários)
-- Trigger de signup: cria tenant + usuário admin automaticamente
-- =============================================================================
-- Quando alguém se cadastra via Supabase Auth, uma linha é inserida em
-- auth.users. Este trigger reage a esse INSERT e provisiona, dentro do schema
-- public, a estrutura mínima que o RLS multi-tenant da Etapa 2 exige:
--
--   1. um registro em public.tenants (o "espaço" do novo cliente);
--   2. um registro em public.users vinculado a esse tenant, com role 'admin'.
--
-- Sem isso, current_tenant_id() retornaria NULL e o RLS bloquearia todo acesso
-- a clientes, orcamentos e pagamentos.
--
-- SECURITY DEFINER: a função roda com os privilégios do owner (não do usuário
-- recém-criado), permitindo escrever em public.tenants/public.users mesmo com
-- RLS habilitado e sem sessão autenticada ainda estabelecida.
--
-- Pré-requisitos: schema da Etapa 2 já aplicado (tabelas tenants e users).
-- Ordem de execução: função -> trigger.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FUNÇÃO: handle_new_user
-- Lê os dados do novo auth.users (email e o 'nome' gravado em user_metadata
-- no cadastro) e cria tenant + usuário admin numa única transação.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_nome      text;
begin
  -- Nome informado no cadastro (options.data.nome); fallback para o e-mail.
  v_nome := coalesce(
    nullif(new.raw_user_meta_data ->> 'nome', ''),
    new.email
  );

  -- 1) Cria o tenant do novo usuário com os dados básicos disponíveis.
  -- Por enquanto só aceitamos clientes argentinos: força região AR, idioma
  -- espanhol e moeda ARS. (Quando expandirmos para o Brasil, revisar aqui.)
  insert into public.tenants (nome_empresa, nome_profissional, email, pais, idioma, moeda_preferida)
  values (v_nome, v_nome, new.email, 'AR', 'es', 'ARS')
  returning id into v_tenant_id;

  -- 2) Cria o usuário vinculado ao tenant, como administrador da conta.
  insert into public.users (id, tenant_id, email, nome, role)
  values (new.id, v_tenant_id, new.email, v_nome, 'admin');

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGER: on_auth_user_created
-- Dispara uma vez por linha, logo após o INSERT em auth.users.
-- DROP idempotente para permitir reaplicar o script com segurança.
-- -----------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- =============================================================================
-- FIM DO TRIGGER
-- =============================================================================
