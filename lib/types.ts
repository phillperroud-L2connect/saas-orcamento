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

/**
 * Plano contratado pelo tenant ("manual" = pagamento fora do Mercado Pago).
 *
 * "max" é o plano superior do segmento web designer — libera os três templates
 * premium (ver lib/templates-core.js). É atribuído pelo admin; ainda NÃO tem
 * preço nem entrada no catálogo de checkout (lib/planos.ts) — a precificação e
 * a página de vendas são um passo posterior.
 */
export type PlanoContratado = "basico" | "pro" | "max" | "manual";
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
  /**
   * Overrides de cor dos templates premium (Plano Max), por template e token —
   * ver supabase-templates-premium.sql e lib/templates-core.js. `null`/ausente
   * = usa as paletas padrão. Estruturado como { [templateId]: { token: hex } }.
   */
  paleta_templates: import("./templates-core").PaletaOverrides | null;
  pais: Pais;
  idioma: Idioma;
  moeda_preferida: MoedaPreferida | null;
  ativo: boolean;
  // Controle de assinatura (ver supabase-tenant-ativo.sql).
  plano: PlanoContratado | null;
  status_assinatura: StatusAssinatura;
  forma_pagamento: FormaPagamento | null;
  vencimento: string | null;
  // Mercado Pago do prestador (OAuth) — ver supabase-mp-usuario.sql.
  // Permite ao tenant receber pagamentos dos clientes finais na própria conta.
  mp_access_token: string | null;
  mp_user_id: string | null;
  mp_refresh_token: string | null;
  mp_email: string | null;
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
  /** Moeda do pagamento (ver supabase-assinatura-moeda.sql). Default 'ARS'. */
  moeda: "ARS" | "BRL";
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
