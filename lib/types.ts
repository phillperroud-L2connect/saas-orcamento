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
  endereco: string | null;
  created_at: string;
};

export type Pais = "BR" | "AR";
export type Idioma = "pt" | "es";
export type MoedaPreferida = "BRL" | "ARS" | "USD";

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
  created_at: string;
};

/** Item de serviço armazenado em orcamentos.itens (jsonb). */
export type OrcamentoItem = {
  descricao: string;
  valor: number;
};
