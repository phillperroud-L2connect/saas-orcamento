-- =============================================================================
-- SaaS Gerador de Orçamento — Numeração sequencial real por tenant
-- =============================================================================
-- Substitui o número aleatório (Math.random no cliente) por uma sequência real
-- ORC-AAAA-NNN, independente por tenant e por ano. Ex.: ORC-2025-001, 002...
--
-- Como funciona:
--   • orcamento_contador guarda o último número usado por (tenant, ano).
--   • O trigger BEFORE INSERT em orcamentos preenche numero quando vier vazio.
--   • SECURITY DEFINER: o incremento é atômico e não depende de RLS/permissão
--     do usuário sobre a tabela contador.
--
-- Idempotente / aditivo. Não altera dados existentes. Números já gravados são
-- preservados (o trigger só age quando numero vem nulo/vazio).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Contador por (tenant, ano)
-- -----------------------------------------------------------------------------
create table if not exists public.orcamento_contador (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ano       int  not null,
  ultimo    int  not null default 0,
  primary key (tenant_id, ano)
);

-- Acessada apenas pela função SECURITY DEFINER abaixo. RLS ligada e sem policy
-- garante que nenhum cliente leia/escreva diretamente.
alter table public.orcamento_contador enable row level security;

-- -----------------------------------------------------------------------------
-- 2. Função + trigger de numeração
-- -----------------------------------------------------------------------------
create or replace function public.set_numero_orcamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ano int := extract(year from now())::int;
  v_seq int;
begin
  -- Respeita número já informado (ex.: edição/reimportação).
  if new.numero is not null and new.numero <> '' then
    return new;
  end if;
  -- Sem tenant não há como numerar por tenant (não deve ocorrer).
  if new.tenant_id is null then
    return new;
  end if;

  insert into public.orcamento_contador (tenant_id, ano, ultimo)
    values (new.tenant_id, v_ano, 1)
    on conflict (tenant_id, ano)
    do update set ultimo = public.orcamento_contador.ultimo + 1
    returning ultimo into v_seq;

  new.numero := 'ORC-' || v_ano || '-' || lpad(v_seq::text, 3, '0');
  return new;
end;
$$;

drop trigger if exists trg_set_numero_orcamento on public.orcamentos;
create trigger trg_set_numero_orcamento
  before insert on public.orcamentos
  for each row
  execute function public.set_numero_orcamento();

-- -----------------------------------------------------------------------------
-- 3. Recarregar cache da API (PostgREST)
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- =============================================================================
-- FIM
-- =============================================================================
