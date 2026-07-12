/**
 * Núcleo PURO da lógica multi-país do Mercado Pago (sem rede, sem env, sem DB).
 *
 * Centraliza as decisões que dependem do país da conta (AR / BR) para que a
 * seleção "país → gaveta de credenciais → moeda → domínio de autorização →
 * preço" tenha uma única fonte da verdade, testável por unit test.
 *
 * Consumido por:
 *   - lib/planos.ts        (catálogo de planos + preços da assinatura)
 *   - lib/mercadopago.ts   (escolha de access_token / credenciais OAuth)
 *   - rotas /api/mp/*      (moeda e domínio conforme o país)
 *   - tests.js             (cobertura da lógica de seleção)
 *
 * Mantido em .js (não .ts) de propósito: `node --test tests.js` importa este
 * módulo diretamente, sem etapa de build — mesmo padrão de payment-audit-core.js.
 */

/** Países suportados. 'AR' é o comportamento herdado (default seguro). */
export const PAISES = ["AR", "BR"];

/**
 * Normaliza um valor arbitrário (query string, metadata, coluna) para um país
 * suportado. Qualquer coisa fora de {AR, BR} cai no default — 'AR' por padrão,
 * preservando o fluxo argentino existente quando o país não é informado.
 */
export function normalizarPais(valor, padrao = "AR") {
  const v = String(valor ?? "").trim().toUpperCase();
  return v === "BR" || v === "AR" ? v : padrao;
}

/** Moeda da assinatura do SaaS conforme o país da conta. */
export function moedaAssinatura(pais) {
  return normalizarPais(pais) === "BR" ? "BRL" : "ARS";
}

/** Idioma padrão do app conforme o país (pt para BR, es para AR). */
export function idiomaDoPais(pais) {
  return normalizarPais(pais) === "BR" ? "pt" : "es";
}

/** País a partir do idioma do checkout/app (pt → BR, es → AR). */
export function paisDoIdioma(idioma) {
  return String(idioma ?? "").trim().toLowerCase() === "pt" ? "BR" : "AR";
}

/**
 * Domínio da tela de AUTORIZAÇÃO OAuth do Mercado Pago conforme o país.
 * (A troca do `code` por token é no mesmo endpoint global api.mercadopago.com;
 * só a UI de autorização muda de domínio por país.)
 */
export function authDomainMp(pais) {
  return normalizarPais(pais) === "BR"
    ? "auth.mercadopago.com.br"
    : "auth.mercadopago.com.ar";
}

/** Locale de formatação monetária da assinatura conforme o país. */
export function localeAssinatura(pais) {
  return normalizarPais(pais) === "BR" ? "pt-BR" : "es-AR";
}

/**
 * Tabela de preços da assinatura do SaaS por plano → país → período.
 * Fonte única da verdade dos valores; planos.ts monta o catálogo a partir daqui.
 *
 * Regra da promoção anual (idêntica nos dois países): anual = 10 mensalidades
 * (2 meses grátis). AR em ARS (valores "cheios", sem centavos); BR em BRL.
 */
export const PRECOS_ASSINATURA = {
  basico: {
    AR: { mensal: 11980, anual: 119800 },
    BR: { mensal: 29.9, anual: 299.0 },
  },
  pro: {
    AR: { mensal: 19850, anual: 198500 },
    BR: { mensal: 38.89, anual: 388.9 },
  },
};

/** Preço da assinatura para (plano, período, país). null se plano desconhecido. */
export function precoAssinatura(planoId, periodo, pais) {
  const porPais = PRECOS_ASSINATURA[planoId];
  if (!porPais) return null;
  const tabela = porPais[normalizarPais(pais)];
  return periodo === "anual" ? tabela.anual : tabela.mensal;
}
