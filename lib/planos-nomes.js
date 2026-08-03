/**
 * Nome de EXIBIÇÃO do plano por idioma — fonte ÚNICA compartilhada.
 *
 * Antes vivia só dentro do i18n do checkout; agora mora aqui para que o checkout
 * e os e-mails transacionais leiam o MESMO nome. Assim, renomear um plano (ex.:
 * "Pro" → "Completo" no Brasil) não dessincroniza mais o e-mail da tela.
 *
 * Localização atual: no Brasil (pt) o plano `pro` é apresentado como "Completo";
 * na Argentina (es) segue "Pro". `basico` é "Básico" nos dois. Os IDS/preços
 * seguem em lib/planos.ts / lib/mp-paises.js (esta é só a etiqueta de exibição).
 *
 * Em .js (com .d.ts) para ser consumível tanto pelo TypeScript (checkout) quanto
 * por `node --test` (email-core), sem etapa de build — padrão de mp-paises.js.
 */

/** Tabela de nomes por idioma → plano. */
const NOMES_PLANO = {
  pt: { basico: "Básico", pro: "Completo" },
  es: { basico: "Básico", pro: "Pro" },
};

/**
 * Nome de exibição do plano no idioma pedido. Idioma fora de {pt, es} cai em es
 * (default legado argentino). Plano desconhecido → string vazia (defensivo).
 *
 * @param {string} planoId  "basico" | "pro"
 * @param {string} lang     "pt" | "es"
 * @returns {string}
 */
export function nomePlanoLocalizado(planoId, lang) {
  const l = String(lang ?? "").toLowerCase() === "pt" ? "pt" : "es";
  const tabela = NOMES_PLANO[l];
  return tabela[planoId] ?? "";
}
