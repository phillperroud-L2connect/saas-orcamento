/**
 * Rótulos LEGÍVEIS dos blocos (seções) — camada de apresentação da UI de
 * toggles "mostrar/esconder" (Plano Pro). NÃO faz parte do motor puro
 * (lib/blocos-core.js): aqui só mora o texto que o usuário leigo lê no lugar do
 * blocoId técnico (ex.: "cabecalho" -> "Cabeçalho" / "Encabezado").
 *
 * Módulo puro (sem React/DOM/rede) e importável por `node --test`, para que um
 * teste garanta que TODO blocoId de TODO template tem rótulo nos dois idiomas —
 * assim nenhum id cru vaza para a tela e o mapa nunca sai de sincronia com
 * BLOCOS_TEMPLATE (lib/blocos-core.js).
 *
 * Os nomes seguem o vocabulário já usado no dicionário do app (lib/i18n.ts):
 * "Serviços/Servicios", "Observações/Observaciones", "Total", etc., para que o
 * rótulo do toggle bata com a seção que o usuário vê no documento renderizado.
 */

/**
 * Rótulo de cada blocoId por idioma. As chaves cobrem a UNIÃO de todos os
 * blocos de todos os templates de BLOCOS_TEMPLATE (os 3 básicos + os 3 premium).
 * @type {Record<string, { pt: string; es: string }>}
 */
export const ROTULOS_BLOCOS = {
  cabecalho: { pt: "Cabeçalho", es: "Encabezado" },
  cliente: { pt: "Cliente", es: "Cliente" },
  servicos: { pt: "Serviços", es: "Servicios" },
  total: { pt: "Total", es: "Total" },
  pagamento: { pt: "Pagamento", es: "Pago" },
  pagar_online: { pt: "Pagar online", es: "Pagar en línea" },
  nota: { pt: "Observações", es: "Observaciones" },
  banco_horas: { pt: "Banco de horas", es: "Banco de horas" },
  projetos: { pt: "Projetos", es: "Proyectos" },
  condicoes: { pt: "Condições gerais", es: "Condiciones generales" },
  rodape: { pt: "Rodapé", es: "Pie de página" },
};

/**
 * Rótulo legível de um bloco no idioma pedido. Defensivo: idioma desconhecido
 * cai em "pt"; blocoId sem rótulo devolve o próprio id (nunca quebra a UI, mas o
 * teste de cobertura impede que isso aconteça em produção).
 * @param {unknown} blocoId
 * @param {"pt" | "es"} [idioma]
 * @returns {string}
 */
export function rotuloBloco(blocoId, idioma = "pt") {
  const id = String(blocoId ?? "");
  const entrada = ROTULOS_BLOCOS[id];
  if (!entrada) return id;
  return entrada[idioma] ?? entrada.pt;
}
