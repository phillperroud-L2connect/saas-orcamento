-- =============================================================================
-- SaaS Gerador de Orçamento — Trilha de auditoria de pagamentos
-- Tabela public.payment_audit_log + restrição server-side do bucket de logos
-- =============================================================================
-- Contexto: registra todo evento relevante do fluxo de pagamento (webhook
-- recebido, status aprovado/pendente/rejeitado) para PROVA em caso de disputa
-- de cobrança. Gravada exclusivamente pela SERVICE ROLE nos webhooks
-- (app/api/mp/webhook e app/api/mp/webhook-orcamento), via lib/payment-audit.ts.
--
-- Decisão de design: tenant_id é uuid SEM foreign key. A trilha de auditoria
-- precisa SOBREVIVER à exclusão de um tenant (app/api/admin/excluir-tenant faz
-- cascade). Um FK com ON DELETE CASCADE apagaria a prova; com SET NULL perderia
-- o vínculo. Guardar o uuid solto mantém o registro imutável e independente.
--
-- Pré-requisito: supabase-schema.sql já aplicado. Rodar uma única vez.
-- =============================================================================

create table if not exists public.payment_audit_log (
  id                  uuid primary key default gen_random_uuid(),
  -- 'aprovado' | 'pendente' | 'rejeitado' | 'status_desconhecido' | 'aprovado'(renovação)
  evento              text not null,
  -- 'assinatura' (SaaS) | 'orcamento' (cliente final do prestador)
  origem              text,
  -- uuid do tenant quando conhecido (sem FK — ver nota acima).
  tenant_id           uuid,
  -- id do pagamento no Mercado Pago (texto: ids grandes).
  mp_payment_id       text,
  external_reference  text,
  -- status bruto retornado pelo Mercado Pago (approved/pending/rejected/...).
  status              text,
  valor               numeric(12,2),
  -- só campos essenciais (plano, período, renovação) — nunca o payload inteiro.
  detalhe             jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

-- Índices para as consultas típicas do suporte: por pagamento, por tenant e por
-- data (linha do tempo dos eventos).
create index if not exists idx_payment_audit_log_mp_payment_id
  on public.payment_audit_log (mp_payment_id);
create index if not exists idx_payment_audit_log_tenant_id
  on public.payment_audit_log (tenant_id);
create index if not exists idx_payment_audit_log_created_at
  on public.payment_audit_log (created_at desc);

-- RLS habilitado SEM política: nenhum usuário comum lê/escreve. A service role
-- (webhooks) bypassa o RLS; a leitura para suporte é feita pelo painel admin,
-- também via service role. Trilha de auditoria não deve ser exposta a tenants.
alter table public.payment_audit_log enable row level security;

-- =============================================================================
-- Item 4 (validação de upload) — enforcement SERVER-SIDE no Supabase Storage.
-- Mantém o fluxo de upload direto do navegador para o Storage, mas o servidor
-- passa a REJEITAR tipos não permitidos e arquivos acima de 2 MB, independente
-- da validação do client (defense-in-depth).
--
-- Requer que o bucket "logos" já exista (criado em Storage → Buckets).
-- 2097152 bytes = 2 MB.
-- =============================================================================
update storage.buckets
set
  file_size_limit   = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'logos';

-- =============================================================================
-- FIM
-- =============================================================================
