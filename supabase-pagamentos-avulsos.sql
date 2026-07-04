-- =============================================================================
-- SaaS Gerador de Orçamento — Aba "Pagamentos"
-- Tabela de PAGAMENTOS AVULSOS (recebimentos manuais, sem orçamento vinculado)
-- =============================================================================
-- Contexto: a aba Pagamentos mostra duas fontes de recebimento:
--   1. Pagamentos DE ORÇAMENTOS — derivados da tabela `orcamentos` (status
--      'aprovado' = pago, 'enviado' = pendente). NÃO precisa de tabela nova;
--      marcar como pago apenas atualiza orcamentos.status.
--   2. Pagamentos AVULSOS — recebimentos digitados à mão que não vieram de um
--      orçamento (ex.: sinal, venda balcão). É o que esta tabela armazena.
--
-- Pré-requisitos: supabase-schema.sql já aplicado (tenants, clientes, RLS e a
-- função helper public.current_tenant_id()).
--
-- Ordem: tabela -> índices -> RLS -> política. Rodar uma única vez no Supabase.
-- =============================================================================

create table if not exists public.pagamentos_avulsos (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  cliente_id      uuid references public.clientes(id) on delete set null,
  descricao       text not null,
  valor           numeric(12,2) not null default 0,
  moeda           text not null default 'BRL' check (moeda in ('BRL', 'ARS', 'USD')),
  status          text not null default 'pendente'
                    check (status in ('pendente', 'pago')),
  data_vencimento date,
  data_pagamento  date,
  created_at      timestamptz not null default now()
);

-- Índices — filtro por tenant e ordenação por data.
create index if not exists idx_pagamentos_avulsos_tenant_id
  on public.pagamentos_avulsos (tenant_id);
create index if not exists idx_pagamentos_avulsos_cliente_id
  on public.pagamentos_avulsos (cliente_id);

-- Row Level Security — cada tenant só enxerga/edita os próprios pagamentos.
alter table public.pagamentos_avulsos enable row level security;

drop policy if exists pagamentos_avulsos_isolation on public.pagamentos_avulsos;
create policy pagamentos_avulsos_isolation on public.pagamentos_avulsos
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- =============================================================================
-- FIM
-- =============================================================================
