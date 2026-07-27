/**
 * Núcleo puro da feature "esconder blocos" (Plano Max).
 *
 * Cada template renderiza uma sequência FIXA de blocos (seções). A feature não
 * reordena nem duplica nada — apenas permite que um tenant Max OCULTE blocos
 * individuais em um orçamento específico. O que se persiste é só uma lista de
 * ids ocultos (coluna `orcamentos.blocos_ocultos`, jsonb). Lista vazia/null =
 * documento completo = exatamente o comportamento de hoje.
 *
 * Este módulo é 100% puro e determinístico (sem React, sem DOM, sem rede), para
 * ser importável por `node --test` e coberto por testes unitários — no mesmo
 * espírito de lib/templates-core.js. O render (etapas seguintes) apenas consome
 * `resolverBlocos` para decidir quais blocos pintar, na ordem canônica.
 */

/**
 * Blocos de cada template, na ORDEM CANÔNICA em que aparecem no documento.
 * Os ids são estáveis: são gravados em `orcamentos.blocos_ocultos` e
 * referenciados pela UI de toggles (etapa posterior). Ordem aqui é a fonte da
 * verdade da sequência do documento; a feature nunca a altera, só remove itens.
 *
 * Observação de granularidade: os blocos são as SEÇÕES já existentes em cada
 * template. Se no futuro for preciso ocultar um elemento mais fino (ex.: só a
 * data dentro do cabeçalho), basta a extração da Etapa 2 quebrar aquele bloco em
 * ids menores e listá-los aqui — o motor abaixo não muda.
 */
export const BLOCOS_TEMPLATE = {
  // --- 3 básicos (já ligados a dados reais) ---
  classico: [
    "cabecalho",
    "cliente",
    "servicos",
    "pagamento",
    "pagar_online",
    "nota",
    "rodape",
  ],
  moderno: [
    "cabecalho",
    "cliente",
    "servicos",
    "total",
    "pagamento",
    "pagar_online",
    "nota",
    "rodape",
  ],
  simples: [
    "cabecalho",
    "cliente",
    "servicos",
    "total",
    "pagamento",
    "nota",
    "pagar_online",
    "rodape",
  ],
  // --- 3 premium (ligados a dados reais na Etapa 3) ---
  // Atelier Noir (3a): orçamento real completo. banco_horas/projetos/condicoes
  // seguem no catálogo mas nascem ocultos (ver BLOCOS_PADRAO_OCULTOS) por não
  // terem fonte de dado no formulário.
  atelier_noir: [
    "cabecalho",
    "cliente",
    "servicos",
    "total",
    "pagamento",
    "pagar_online",
    "nota",
    "banco_horas",
    "projetos",
    "condicoes",
    "rodape",
  ],
  // Blueprint Técnico (3b): orçamento real completo, mesma sequência do Atelier.
  // banco_horas/projetos/condicoes seguem no catálogo mas nascem ocultos (ver
  // BLOCOS_PADRAO_OCULTOS) por não terem fonte de dado no formulário.
  blueprint_tecnico: [
    "cabecalho",
    "cliente",
    "servicos",
    "total",
    "pagamento",
    "pagar_online",
    "nota",
    "banco_horas",
    "projetos",
    "condicoes",
    "rodape",
  ],
  swiss_studio: [
    "cabecalho",
    "servicos",
    "banco_horas",
    "projetos",
    "condicoes",
    "rodape",
  ],
};

/**
 * Blocos que nascem OCULTOS por padrão em cada template — constante de código,
 * NÃO dado gravado no banco. São blocos que existem no catálogo (para o dia em
 * que houver fonte de dado) mas hoje não têm o que renderizar, então não entram
 * no documento a menos que uma etapa futura passe a alimentá-los. Diferente do
 * `blocos_ocultos` por orçamento: aquele é a escolha do tenant; este é um
 * default de projeto. `resolverBlocos` esconde a UNIÃO dos dois.
 *
 * Templates sem entrada aqui não têm nenhum bloco oculto por padrão (os 3
 * básicos, e os premium ainda não convertidos).
 */
export const BLOCOS_PADRAO_OCULTOS = {
  atelier_noir: ["banco_horas", "projetos", "condicoes"],
  blueprint_tecnico: ["banco_horas", "projetos", "condicoes"],
};

/**
 * Catálogo (ordem canônica completa) de blocos de um template. Consumido pela
 * UI de toggles para listar tudo o que dá para mostrar/esconder. Template
 * desconhecido → lista vazia (nunca lança).
 * @param {unknown} templateId
 * @returns {string[]}
 */
export function blocosDoTemplate(templateId) {
  const lista = BLOCOS_TEMPLATE[String(templateId ?? "")];
  return Array.isArray(lista) ? [...lista] : [];
}

/**
 * Conjunto de ids ocultos VÁLIDOS para um template — defensivo por design.
 *
 * Aceita qualquer entrada (o valor vem de jsonb do banco): se não for array,
 * trata como "nada oculto". Descarta itens que não são strings e ids que não
 * pertencem a este template (ex.: sobra de quando outro template estava
 * selecionado). Deduplica. É a forma canônica para persistir e comparar.
 * @param {unknown} templateId
 * @param {unknown} ocultos
 * @returns {string[]}
 */
export function normalizarOcultos(templateId, ocultos) {
  if (!Array.isArray(ocultos)) return [];
  const validos = new Set(blocosDoTemplate(templateId));
  const vistos = new Set();
  const saida = [];
  for (const item of ocultos) {
    if (typeof item !== "string") continue;
    if (!validos.has(item)) continue;
    if (vistos.has(item)) continue;
    vistos.add(item);
    saida.push(item);
  }
  return saida;
}

/**
 * Um bloco está oculto neste orçamento?
 * @param {unknown} templateId
 * @param {unknown} ocultos
 * @param {string} blocoId
 * @returns {boolean}
 */
export function estaOculto(templateId, ocultos, blocoId) {
  return normalizarOcultos(templateId, ocultos).includes(blocoId);
}

/**
 * Blocos VISÍVEIS de um orçamento, na ordem canônica do template, já removidos
 * os ocultos. Esta é a lista que o render percorre.
 *
 * Esconde a UNIÃO dos blocos ocultos por padrão do template
 * (BLOCOS_PADRAO_OCULTOS) com os ocultos escolhidos neste orçamento (`ocultos`).
 *
 * Garantias:
 *   - ordem canônica sempre preservada (a feature nunca reordena);
 *   - `ocultos` malformado/null → só os ocultos-por-padrão saem (nos templates
 *     sem padrão, isso é o documento completo — comportamento atual dos básicos);
 *   - id oculto desconhecido é simplesmente ignorado;
 *   - template desconhecido → [] (o caller deve resolver o template antes, via
 *     resolverTemplate de templates-core; aqui não se inventa fallback).
 * @param {unknown} templateId
 * @param {unknown} ocultos
 * @returns {string[]}
 */
export function resolverBlocos(templateId, ocultos) {
  const ordem = blocosDoTemplate(templateId);
  if (ordem.length === 0) return [];
  const padrao = BLOCOS_PADRAO_OCULTOS[String(templateId ?? "")] ?? [];
  const escondidos = new Set([
    ...padrao,
    ...normalizarOcultos(templateId, ocultos),
  ]);
  return ordem.filter((id) => !escondidos.has(id));
}
