/**
 * Catálogo de planos do SaaS (checkout via Mercado Pago).
 *
 * Suporta dois países: Argentina (ARS) e Brasil (BRL). Os VALORES dos preços
 * ficam centralizados em lib/mp-paises.js (fonte única, testável); aqui mora só
 * o catálogo de exibição (nome, descrição, recursos) + os helpers de seleção.
 *
 * A promoção anual é idêntica nos dois países: anual = 10 mensalidades
 * (2 meses grátis). Para adicionar novos períodos (trimestral/semestral) no
 * futuro, estenda PRECOS_ASSINATURA em mp-paises.js e o tipo Periodo abaixo.
 */

import type { Pais } from "./types";
import {
  PRECOS_ASSINATURA,
  precoAssinatura,
  moedaAssinatura as moedaAssinaturaCore,
  localeAssinatura,
  paisDoIdioma as paisDoIdiomaCore,
} from "./mp-paises";

export type PlanoId = "basico" | "pro";

/** Periodicidade de cobrança escolhida no checkout. */
export type Periodo = "mensal" | "anual";

/** Moeda em que a assinatura é cobrada, conforme o país. */
export type MoedaAssinatura = "ARS" | "BRL";

export type Plano = {
  id: PlanoId;
  nome: string;
  descricao: string;
  destaque?: boolean;
  recursos: string[];
};

export const PLANOS: Record<PlanoId, Plano> = {
  basico: {
    id: "basico",
    nome: "Básico",
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

/** Type guard: confirma se uma string é um Periodo válido. */
export function isPeriodo(valor: string): valor is Periodo {
  return valor === "mensal" || valor === "anual";
}

/** Retorna o plano pelo id ou `null` se desconhecido. */
export function getPlano(valor: string): Plano | null {
  return isPlanoId(valor) ? PLANOS[valor] : null;
}

/** Moeda da assinatura conforme o país da conta (AR → ARS, BR → BRL). */
export function moedaAssinatura(pais: Pais): MoedaAssinatura {
  return moedaAssinaturaCore(pais) as MoedaAssinatura;
}

/** País a partir do idioma do checkout/app (pt → BR, es → AR). */
export function paisDoIdioma(idioma: string): Pais {
  return paisDoIdiomaCore(idioma) as Pais;
}

/**
 * Valor cobrado para o plano no período escolhido, na moeda do país.
 * `pais` default "AR" preserva o comportamento dos chamadores legados.
 */
export function getPrecoPorPeriodo(
  plano: Plano,
  periodo: Periodo,
  pais: Pais = "AR",
): number {
  const preco = precoAssinatura(plano.id, periodo, pais);
  // Fallback defensivo: plano sempre existe no catálogo, mas nunca retorna NaN.
  return preco ?? 0;
}

/** Equivalente mensal do plano anual (anual ÷ 12), para reforçar a economia. */
export function equivalenteMensalAnual(plano: Plano, pais: Pais = "AR"): number {
  const anual = precoAssinatura(plano.id, "anual", pais) ?? 0;
  return anual / 12;
}

/** Formata um preço da assinatura na moeda/locale do país. */
export function formatarPreco(preco: number, pais: Pais = "AR"): string {
  const moeda = moedaAssinatura(pais);
  // ARS usa valores "cheios" (sem centavos); BRL mostra os centavos.
  const casas = pais === "BR" ? 2 : 0;
  try {
    return new Intl.NumberFormat(localeAssinatura(pais), {
      style: "currency",
      currency: moeda,
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    }).format(preco);
  } catch {
    return `${moeda} ${preco.toFixed(casas)}`;
  }
}

// Re-export para conveniência de quem importa só a tabela de preços.
export { PRECOS_ASSINATURA };
