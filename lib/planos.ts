/**
 * Catálogo de planos do SaaS (checkout via Mercado Pago Argentina).
 *
 * Preços em ARS (centavos NÃO — Mercado Pago usa o valor "cheio" como número).
 * Ajuste `preco` conforme a precificação comercial real — estes são valores
 * iniciais e ficam centralizados aqui para serem a única fonte da verdade,
 * usada tanto pela página de checkout quanto pela criação da preferência.
 */

export type PlanoId = "basico" | "pro";

export type Plano = {
  id: PlanoId;
  nome: string;
  /** Valor cobrado por mês, em ARS. */
  preco: number;
  moeda: "ARS";
  descricao: string;
  destaque?: boolean;
  recursos: string[];
};

export const PLANOS: Record<PlanoId, Plano> = {
  basico: {
    id: "basico",
    nome: "Básico",
    preco: 11980,
    moeda: "ARS",
    descricao: "Para profissionais que estão começando a organizar seus orçamentos.",
    recursos: [
      "Orçamentos ilimitados",
      "Exportação em PDF",
      "Catálogo de serviços",
      "1 usuário",
    ],
  },
  pro: {
    id: "pro",
    nome: "Pro",
    preco: 19850,
    moeda: "ARS",
    descricao: "Para quem precisa de mais controle, marca e relatórios.",
    destaque: true,
    recursos: [
      "Tudo do plano Básico",
      "Personalização da marca (logo e cor)",
      "Dashboard financeiro",
      "Templates de orçamento",
      "Suporte prioritário",
    ],
  },
};

/** Type guard: confirma se uma string é um PlanoId válido. */
export function isPlanoId(valor: string): valor is PlanoId {
  return valor === "basico" || valor === "pro";
}

/** Retorna o plano pelo id ou `null` se desconhecido. */
export function getPlano(valor: string): Plano | null {
  return isPlanoId(valor) ? PLANOS[valor] : null;
}

/** Formata o preço de um plano em ARS (es-AR). */
export function formatarPrecoARS(preco: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(preco);
}
