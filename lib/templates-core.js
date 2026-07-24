/**
 * Núcleo PURO dos templates visuais do PDF (sem React, sem DOM, sem rede).
 *
 * Reúne três responsabilidades que precisam de uma única fonte da verdade:
 *
 *   1. MATEMÁTICA DE COR — mistura, elevação em HSL, luminância e contraste.
 *      É o substituto de `color-mix()`/variáveis CSS: os templates são
 *      estilizados INLINE porque a prévia é rasterizada por html2canvas para
 *      virar o PDF, e o html2canvas não computa `color-mix()` nem resolve
 *      custom properties de forma confiável (o que ele não computa sai preto
 *      ou transparente no PDF). Fazendo a conta em JS, o valor que chega ao
 *      style já é um hex literal — a prévia e o PDF ficam idênticos.
 *
 *   2. CATÁLOGO E GATING — quais templates existem e qual plano cada um exige.
 *
 *   3. PALETAS — os tokens editáveis de cada template premium e a derivação
 *      automática de TODO o resto (superfícies, bordas, tons de apoio), com
 *      piso de contraste garantido para que trocar as cores não quebre a
 *      legibilidade do documento.
 *
 * Mantido em .js (não .ts) de propósito: `node --test tests.js` importa este
 * módulo diretamente, sem etapa de build — mesmo padrão de mp-paises.js e
 * payment-audit-core.js. Os tipos literais vivem em templates-core.d.ts.
 */

/* ===========================================================================
 * 1) MATEMÁTICA DE COR
 * ======================================================================== */

/** Prende um número ao intervalo [min, max]. */
function limitar(n, min, max) {
  return n < min ? min : n > max ? max : n;
}

/**
 * Normaliza um valor arbitrário (input do usuário, coluna jsonb) para um hex
 * "#rrggbb" minúsculo. Aceita a forma curta "#abc". Devolve `padrao` para
 * qualquer coisa que não seja uma cor válida — nunca lança.
 */
export function normalizarHex(valor, padrao = null) {
  const v = String(valor ?? "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  return padrao;
}

/** Converte "#rrggbb" em {r, g, b} (0–255). Assume hex já normalizado. */
export function hexParaRgb(hex) {
  const h = normalizarHex(hex, "#000000");
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}

/** Converte {r, g, b} (0–255, arredondado e limitado) em "#rrggbb". */
export function rgbParaHex({ r, g, b }) {
  const bit = (n) =>
    limitar(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${bit(r)}${bit(g)}${bit(b)}`;
}

/** Converte {r,g,b} 0–255 em {h: 0–360, s: 0–100, l: 0–100}. */
export function rgbParaHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return { h: 0, s: 0, l: l * 100 };

  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;

  return { h, s: s * 100, l: l * 100 };
}

/** Converte {h, s, l} de volta em {r, g, b} 0–255. */
export function hslParaRgb({ h, s, l }) {
  const sn = limitar(s, 0, 100) / 100;
  const ln = limitar(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hh = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = ln - c / 2;

  let rgb;
  if (hh < 1) rgb = [c, x, 0];
  else if (hh < 2) rgb = [x, c, 0];
  else if (hh < 3) rgb = [0, c, x];
  else if (hh < 4) rgb = [0, x, c];
  else if (hh < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return {
    r: (rgb[0] + m) * 255,
    g: (rgb[1] + m) * 255,
    b: (rgb[2] + m) * 255,
  };
}

/**
 * Equivalente a `color-mix(in srgb, base, alvo pct%)`: devolve a cor que está
 * a `pct` por cento do caminho entre `base` e `alvo`, no espaço sRGB.
 *
 * `pct` 0 devolve `base`; 100 devolve `alvo`. Valores fora da faixa são presos.
 */
export function misturar(base, alvo, pct) {
  const p = limitar(Number(pct) || 0, 0, 100) / 100;
  const a = hexParaRgb(base);
  const b = hexParaRgb(alvo);
  return rgbParaHex({
    r: a.r + (b.r - a.r) * p,
    g: a.g + (b.g - a.g) * p,
    b: a.b + (b.b - a.b) * p,
  });
}

/**
 * Desloca a cor em HSL preservando a MATIZ — a operação que "clarear com
 * branco" não faz bem. Misturar com branco lava a cor (perde saturação e puxa
 * para o pastel); elevar a luminosidade mantém o caráter do tom.
 *
 * `deltaL` e `deltaS` são somados em pontos percentuais (podem ser negativos).
 * É assim que se deriva, por exemplo, o dourado claro a partir do dourado
 * principal: a variante continua sendo *aquele* dourado, só que mais alta.
 */
export function elevar(hex, deltaL, deltaS = 0) {
  const hsl = rgbParaHsl(hexParaRgb(hex));
  return rgbParaHex(
    hslParaRgb({
      h: hsl.h,
      s: limitar(hsl.s + (Number(deltaS) || 0), 0, 100),
      l: limitar(hsl.l + (Number(deltaL) || 0), 0, 100),
    }),
  );
}

/** Luminância relativa (WCAG 2.1). Retorna 0 (preto) a 1 (branco). */
export function luminancia(hex) {
  const { r, g, b } = hexParaRgb(hex);
  const canal = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Razão de contraste WCAG entre duas cores. Vai de 1 (igual) a 21 (p&b). */
export function contraste(a, b) {
  const la = luminancia(a);
  const lb = luminancia(b);
  const claro = Math.max(la, lb);
  const escuro = Math.min(la, lb);
  return (claro + 0.05) / (escuro + 0.05);
}

/** `true` quando a cor é escura o bastante para pedir texto claro por cima. */
export function ehEscuro(hex) {
  return luminancia(hex) < 0.5;
}

/**
 * Entre os candidatos informados, devolve o que tem MAIOR contraste sobre
 * `fundo`. Usado para escolher a cor do texto que fica por cima de um bloco
 * pintado com o acento (botão, faixa de total): se o usuário trocar o acento
 * por um tom claro, o texto vira o tom escuro da paleta sozinho.
 */
export function melhorContraste(fundo, candidatos) {
  const lista = (candidatos ?? []).filter(Boolean);
  if (lista.length === 0) return ehEscuro(fundo) ? "#ffffff" : "#000000";
  let melhor = lista[0];
  let melhorRatio = contraste(fundo, melhor);
  for (const c of lista.slice(1)) {
    const r = contraste(fundo, c);
    if (r > melhorRatio) {
      melhor = c;
      melhorRatio = r;
    }
  }
  return melhor;
}

/**
 * Empurra `cor` na direção que se AFASTA de `fundo` (mais clara sobre fundo
 * escuro, mais escura sobre fundo claro) até atingir a razão de contraste
 * mínima — preservando a matiz.
 *
 * É a trava que impede a paleta editável de produzir um documento ilegível:
 * o usuário pode escolher um vinho quase preto para o Atelier Noir que o texto
 * daquele vinho sobre a superfície escura ainda vai ser lido. Se nem o extremo
 * (branco ou preto) atingir o mínimo, devolve esse extremo — melhor esforço.
 */
export function garantirContraste(cor, fundo, minimo = 4.5) {
  const base = normalizarHex(cor, "#000000");
  if (contraste(base, fundo) >= minimo) return base;

  const paraCima = ehEscuro(fundo);
  const passo = paraCima ? 2 : -2;
  let atual = base;

  // 50 passos de 2 pontos cobrem a faixa inteira de luminosidade (0–100).
  for (let i = 0; i < 50; i++) {
    atual = elevar(atual, passo);
    if (contraste(atual, fundo) >= minimo) return atual;
  }
  return paraCima ? "#ffffff" : "#000000";
}

/* ===========================================================================
 * 2) CATÁLOGO DE TEMPLATES E GATING POR PLANO
 * ======================================================================== */

/**
 * Planos que dão direito a cada template.
 *
 * Os três templates originais (clássico/moderno/simples) seguem liberados para
 * todo mundo — `null` significa "sem exigência de plano". Os três templates do
 * segmento web designer exigem o plano `max`.
 *
 * `max` é um plano CONTRATADO (atribuído pelo admin em tenants.plano); ele não
 * entra no catálogo de checkout (lib/planos.ts) porque a precificação e a
 * página de vendas são um passo posterior.
 */
export const TEMPLATES = {
  classico: { id: "classico", planoExigido: null, premium: false },
  moderno: { id: "moderno", planoExigido: null, premium: false },
  simples: { id: "simples", planoExigido: null, premium: false },
  atelier_noir: { id: "atelier_noir", planoExigido: "max", premium: true },
  blueprint_tecnico: {
    id: "blueprint_tecnico",
    planoExigido: "max",
    premium: true,
  },
  swiss_studio: { id: "swiss_studio", planoExigido: "max", premium: true },
};

/** Ids dos templates na ordem em que aparecem no seletor. */
export const TEMPLATES_ORDEM = [
  "classico",
  "moderno",
  "simples",
  "atelier_noir",
  "blueprint_tecnico",
  "swiss_studio",
];

/** Ids dos três templates premium exclusivos do plano Max. */
export const TEMPLATES_MAX = [
  "atelier_noir",
  "blueprint_tecnico",
  "swiss_studio",
];

/** Template usado quando o valor gravado é desconhecido ou nulo. */
export const TEMPLATE_PADRAO = "classico";

/** Type guard: a string é um id de template conhecido? */
export function isTemplateId(valor) {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, String(valor ?? ""));
}

/** Plano exigido pelo template, ou `null` se é livre. Desconhecido → null. */
export function planoDoTemplate(templateId) {
  const t = TEMPLATES[String(templateId ?? "")];
  return t ? t.planoExigido : null;
}

/**
 * O tenant com este plano pode usar este template?
 *
 * Regra: template livre → sempre sim. Template que exige `max` → só quem tem
 * `plano === "max"`. Plano nulo/desconhecido (conta antiga ou ainda sem plano
 * gravado) é tratado como SEM acesso ao premium — negar é o lado seguro.
 * Template desconhecido → não, para que um id inválido nunca renderize.
 */
export function podeUsarTemplate(plano, templateId) {
  if (!isTemplateId(templateId)) return false;
  const exigido = planoDoTemplate(templateId);
  if (exigido === null) return true;
  return String(plano ?? "") === exigido;
}

/** Lista dos templates que este plano pode efetivamente selecionar. */
export function templatesDisponiveis(plano) {
  return TEMPLATES_ORDEM.filter((id) => podeUsarTemplate(plano, id));
}

/**
 * Resolve o template que deve ser REALMENTE renderizado.
 *
 * Se o tenant perder o plano Max (downgrade, inadimplência) os orçamentos que
 * já estavam gravados com um template premium continuam abrindo — mas caem no
 * template padrão em vez de vazar um layout pago. Também protege contra um id
 * inválido vindo do banco.
 */
export function resolverTemplate(plano, templateId) {
  return podeUsarTemplate(plano, templateId)
    ? String(templateId)
    : TEMPLATE_PADRAO;
}

/* ===========================================================================
 * 3) PALETAS EDITÁVEIS DOS TEMPLATES PREMIUM
 * ======================================================================== */

/**
 * Tokens de cor editáveis de cada template premium — o equivalente ao bloco
 * `:root` de uma folha de estilo, só que em dado puro para sobreviver ao
 * html2canvas.
 *
 * Deliberadamente enxuto (3 a 4 tokens por template): tudo o que dá para
 * calcular fica fora daqui e é derivado em `derivarTema`. Quanto menos cor o
 * usuário controla, menos combinação ilegível ele consegue produzir.
 *
 * `rotulo` é a chave de i18n usada no editor de paleta das Configurações.
 */
export const PALETAS_PADRAO = {
  atelier_noir: {
    fundo: "#0d0d0d",
    texto: "#f0ede8",
    dourado: "#c8a96e",
    vinho: "#7a2138",
  },
  blueprint_tecnico: {
    fundo: "#0a0e14",
    texto: "#dbe6ef",
    ciano: "#4fd8e8",
    ambar: "#ffb454",
  },
  swiss_studio: {
    fundo: "#f6f4ef",
    tinta: "#14110d",
    vermelho: "#e8432b",
  },
};

/** Ordem dos tokens no editor de paleta (por template). */
export const PALETA_TOKENS = {
  atelier_noir: ["fundo", "texto", "dourado", "vinho"],
  blueprint_tecnico: ["fundo", "texto", "ciano", "ambar"],
  swiss_studio: ["fundo", "tinta", "vermelho"],
};

/**
 * Combina a paleta padrão do template com os overrides salvos pelo tenant
 * (coluna jsonb `tenants.paleta_templates`).
 *
 * Blindado de propósito: chave desconhecida é ignorada, hex inválido cai no
 * padrão daquele token, e um `overrides` que não seja objeto é descartado
 * inteiro. O jsonb vem do banco e pode ter qualquer formato.
 */
export function paletaEfetiva(templateId, overrides) {
  const padrao = PALETAS_PADRAO[String(templateId ?? "")];
  if (!padrao) return null;

  const doTenant =
    overrides && typeof overrides === "object" && !Array.isArray(overrides)
      ? overrides[String(templateId)]
      : null;

  const paleta = { ...padrao };
  if (doTenant && typeof doTenant === "object" && !Array.isArray(doTenant)) {
    for (const token of PALETA_TOKENS[templateId]) {
      const hex = normalizarHex(doTenant[token]);
      if (hex) paleta[token] = hex;
    }
  }
  return paleta;
}

/**
 * Quanto a superfície sobe em relação ao fundo, em pontos de luminosidade HSL.
 * Calibrado para que os fundos padrão produzam exatamente as superfícies de
 * referência dos templates (#0d0d0d → #161616, #0a0e14 → #0f151f) mantendo a
 * matiz — um fundo navy gera uma superfície navy, não cinza.
 */
const ELEVACAO_SUPERFICIE = 3.4;

/**
 * Piso de contraste para texto pequeno (WCAG AA, 4.5:1) e para texto grande —
 * títulos e os preços em corpo de cartaz, onde a norma aceita 3:1.
 *
 * A distinção não é preciosismo: forçar 4.5 no preço gigante do Swiss Studio
 * escureceria o vermelho #e8432b (3.63 sobre o papel) e trairia a paleta que o
 * template define. Em texto grande ele passa e fica exatamente como desenhado.
 */
const CONTRASTE_TEXTO = 4.5;
const CONTRASTE_TEXTO_GRANDE = 3;

/**
 * Deriva o tema COMPLETO do template a partir dos poucos tokens editáveis.
 *
 * Nenhum componente de template inventa cor: todos consomem estes valores. É o
 * ponto único onde o contraste é garantido, então trocar um token no seletor
 * não tem como quebrar a legibilidade do documento — os tons de apoio se
 * recalculam junto e passam pelo piso WCAG.
 *
 * Retorna `null` para templates sem paleta (os três legados usam a cor única
 * `tenant.cor_primaria` e não passam por aqui).
 */
export function derivarTema(templateId, overrides) {
  const p = paletaEfetiva(templateId, overrides);
  if (!p) return null;

  if (templateId === "atelier_noir") {
    const superficie = elevar(p.fundo, ELEVACAO_SUPERFICIE);
    return {
      paleta: p,
      fundo: p.fundo,
      superficie,
      // Realce de bloco: um degrau acima da superfície, ainda na mesma matiz.
      superficieAlta: elevar(p.fundo, ELEVACAO_SUPERFICIE * 2),
      texto: garantirContraste(p.texto, superficie, 7),
      // Texto secundário: recuado na direção do fundo, mas nunca abaixo do
      // piso de 4.5:1 — é onde um "cinza elegante" costuma virar ilegível.
      textoSuave: garantirContraste(
        misturar(p.texto, p.fundo, 42),
        superficie,
        CONTRASTE_TEXTO,
      ),
      acento: p.dourado,
      // Variante clara do dourado: elevação em HSL (não mistura com branco),
      // então ela continua dourada em vez de virar bege lavado.
      acentoClaro: elevar(p.dourado, 12.5, 21),
      acentoTexto: garantirContraste(p.dourado, superficie, CONTRASTE_TEXTO),
      acentoTextoGrande: garantirContraste(
        p.dourado,
        superficie,
        CONTRASTE_TEXTO_GRANDE,
      ),
      sobreAcento: melhorContraste(p.dourado, [p.fundo, p.texto]),
      secundario: p.vinho,
      secundarioTexto: garantirContraste(p.vinho, superficie, CONTRASTE_TEXTO),
      sobreSecundario: melhorContraste(p.vinho, [p.fundo, p.texto]),
      // Hairline: quase a superfície, só o suficiente para separar sem virar
      // grade. Divisor é o degrau visível usado entre linhas de serviço.
      hairline: misturar(superficie, p.texto, 14),
      divisor: misturar(superficie, p.texto, 24),
      raio: "3px",
    };
  }

  if (templateId === "blueprint_tecnico") {
    const superficie = elevar(p.fundo, ELEVACAO_SUPERFICIE);
    return {
      paleta: p,
      fundo: p.fundo,
      superficie,
      superficieAlta: elevar(p.fundo, ELEVACAO_SUPERFICIE * 2),
      texto: garantirContraste(p.texto, superficie, 7),
      textoSuave: garantirContraste(
        misturar(p.texto, p.fundo, 45),
        superficie,
        CONTRASTE_TEXTO,
      ),
      acento: p.ciano,
      acentoClaro: elevar(p.ciano, 10, 8),
      acentoTexto: garantirContraste(p.ciano, superficie, CONTRASTE_TEXTO),
      acentoTextoGrande: garantirContraste(
        p.ciano,
        superficie,
        CONTRASTE_TEXTO_GRANDE,
      ),
      sobreAcento: melhorContraste(p.ciano, [p.fundo, p.texto]),
      secundario: p.ambar,
      secundarioTexto: garantirContraste(p.ambar, superficie, CONTRASTE_TEXTO),
      sobreSecundario: melhorContraste(p.ambar, [p.fundo, p.texto]),
      hairline: misturar(superficie, p.texto, 16),
      divisor: misturar(superficie, p.texto, 26),
      // Pontos da malha técnica do fundo: presentes, nunca protagonistas.
      grade: misturar(p.fundo, p.ciano, 18),
      raio: "0px",
    };
  }

  if (templateId === "swiss_studio") {
    // Tema claro: a superfície DESCE em relação ao papel de fundo, senão o
    // cartão sumiria dentro dele.
    const superficie = elevar(p.fundo, -1.8);
    return {
      paleta: p,
      fundo: p.fundo,
      superficie,
      superficieAlta: elevar(p.fundo, -4),
      texto: garantirContraste(p.tinta, p.fundo, 7),
      textoSuave: garantirContraste(
        misturar(p.tinta, p.fundo, 38),
        p.fundo,
        CONTRASTE_TEXTO,
      ),
      acento: p.vermelho,
      acentoClaro: elevar(p.vermelho, 8, 4),
      acentoTexto: garantirContraste(p.vermelho, p.fundo, CONTRASTE_TEXTO),
      // Os preços em corpo de cartaz usam este: o vermelho da paleta intacto.
      acentoTextoGrande: garantirContraste(
        p.vermelho,
        p.fundo,
        CONTRASTE_TEXTO_GRANDE,
      ),
      sobreAcento: melhorContraste(p.vermelho, [p.fundo, p.tinta]),
      // Sem terceira cor: o secundário é a própria tinta, por definição do
      // template (um único acento).
      secundario: p.tinta,
      secundarioTexto: garantirContraste(p.tinta, p.fundo, 7),
      sobreSecundario: melhorContraste(p.tinta, [p.fundo]),
      // Hairlines grossas em tinta cheia — a régua do estilo suíço.
      hairline: p.tinta,
      divisor: misturar(p.fundo, p.tinta, 22),
      // Numeração de seção em outline: precisa ser lida como estrutura, não
      // como texto, então fica bem recuada.
      outline: misturar(p.fundo, p.tinta, 30),
      raio: "0px",
    };
  }

  return null;
}
