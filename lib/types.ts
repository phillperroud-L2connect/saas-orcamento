/**
 * Tipos compartilhados do SaaS Gerador de Orçamento.
 * Refletem as tabelas definidas em supabase-schema.sql.
 */

export type Cliente = {
  id: string;
  tenant_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  documento: string | null;
  endereco: string | null;
  created_at: string;
};

export type Pais = "BR" | "AR";
export type Idioma = "pt" | "es";
export type MoedaPreferida = "BRL" | "ARS" | "USD";

/** Plano contratado pelo tenant ("manual" = pagamento fora do Mercado Pago). */
export type PlanoContratado = "basico" | "pro" | "manual";
/** Status de pagamento da assinatura (badge colorido no admin). */
export type StatusAssinatura = "pago" | "pendente" | "inadimplente";
/** Como o cliente paga a assinatura. */
export type FormaPagamento = "mercado_pago" | "transferencia" | "dinheiro";

export type Tenant = {
  id: string;
  nome_empresa: string;
  nome_profissional: string | null;
  email: string;
  telefone: string | null;
  logo_url: string | null;
  cor_primaria: string | null;
  pais: Pais;
  idioma: Idioma;
  moeda_preferida: MoedaPreferida | null;
  ativo: boolean;
  // Controle de assinatura (ver supabase-tenant-ativo.sql).
  plano: PlanoContratado | null;
  status_assinatura: StatusAssinatura;
  forma_pagamento: FormaPagamento | null;
  vencimento: string | null;
  created_at: string;
};

/** Registro de pagamento (histórico) — tabela public.assinaturas. */
export type Assinatura = {
  id: string;
  mp_payment_id: string;
  mp_preference_id: string | null;
  external_reference: string | null;
  plano: PlanoContratado;
  nome: string | null;
  email: string;
  whatsapp: string | null;
  valor: number | null;
  status: string;
  forma_pagamento: FormaPagamento | string;
  tenant_id: string | null;
  created_at: string;
};

/** Item de serviço armazenado em orcamentos.itens (jsonb). */
export type OrcamentoItem = {
  descricao: string;
  valor: number;
};

/** Serviço do catálogo do tenant ("Meus Serviços") com preço padrão. */
export type Servico = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  nome: string;
  preco: number;
  created_at: string;
};
