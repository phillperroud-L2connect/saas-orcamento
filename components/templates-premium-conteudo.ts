/**
 * Conteúdo fictício de demonstração dos três templates premium (segmento web
 * designer). NUNCA usa dados de cliente real — é uma vitrine de menu de
 * serviços de um estúdio de exemplo, exibida na rota de preview para revisão
 * visual e como amostra do que o plano Max oferece.
 *
 * A ESTRUTURA (as sete seções e seus valores) é idêntica nos três templates —
 * o que muda é só a pele visual. Por isso o conteúdo mora aqui, uma vez, e cada
 * template consome o mesmo objeto.
 *
 * Bilíngue (pt/es) porque a rota de preview e o app inteiro atendem os dois
 * idiomas; os VALORES em dólar não mudam entre idiomas.
 */

export type ItemServico = {
  /** Rótulo curto para numeração/índice (ex.: "01"). */
  ordem: string;
  nome: string;
  descricao: string;
  /** Valor numérico em USD (formatado pelo template). */
  valor: number;
  /** Entregáveis/itens inclusos — bullets curtos. */
  inclui: string[];
  /** Etiqueta opcional (ex.: "MAIS PEDIDO"). */
  tag?: string;
};

export type PacoteHoras = {
  nome: string;
  detalhe: string;
  valor: number;
  /** Preço unitário derivado, já formatado como string curta. */
  unit: string;
};

export type ConteudoDemo = {
  estudio: string;
  tagline: string;
  intro: string;
  moeda: string;
  /** Formata um valor USD no padrão do idioma. */
  fmt: (v: number) => string;
  secoes: {
    servicosTitulo: string;
    bancoHorasTitulo: string;
    bancoHorasSub: string;
    projetosTitulo: string;
    projetosTexto: string;
    condicoesTitulo: string;
    condicoes: string[];
  };
  landing: ItemServico[];
  institucional: ItemServico[];
  horas: PacoteHoras[];
  rodape: string;
};

const USD = (locale: string) => (v: number) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

const PT: ConteudoDemo = {
  estudio: "Studio Exemplo",
  tagline: "Design & Desenvolvimento Web",
  intro:
    "Tabela de referência de serviços e condições comerciais. Valores em dólar, sujeitos a escopo fechado em briefing.",
  moeda: "USD",
  fmt: USD("pt-BR"),
  secoes: {
    servicosTitulo: "Serviços",
    bancoHorasTitulo: "Banco de Horas",
    bancoHorasSub: "Manutenção, ajustes e evoluções pós-entrega.",
    projetosTitulo: "Projetos Especiais",
    projetosTexto:
      "E-commerce, sistemas sob medida, identidade visual completa e integrações. Escopo e prazo definidos após reunião de descoberta — orçamento dedicado.",
    condicoesTitulo: "Condições Comerciais",
    condicoes: [
      "50% na aprovação, 50% na entrega final.",
      "Prazo médio de 2 a 6 semanas conforme o pacote.",
      "Duas rodadas de revisão inclusas em cada projeto.",
      "Orçamento válido por 15 dias.",
    ],
  },
  landing: [
    {
      ordem: "01",
      nome: "Landing Page Simples",
      descricao: "Página única, foco em conversão, uma dobra principal.",
      valor: 280,
      inclui: ["Uma seção hero + CTA", "Responsivo", "Formulário de contato"],
    },
    {
      ordem: "02",
      nome: "Landing Page Premium",
      descricao: "Página longa, animações de entrada, copy e SEO on-page.",
      valor: 420,
      tag: "MAIS PEDIDO",
      inclui: [
        "Múltiplas seções",
        "Animações no scroll",
        "SEO on-page",
        "Integração de analytics",
      ],
    },
  ],
  institucional: [
    {
      ordem: "03",
      nome: "Institucional Simples",
      descricao: "Site de apresentação até 5 páginas.",
      valor: 650,
      inclui: ["Até 5 páginas", "Blog opcional", "Painel de edição"],
    },
    {
      ordem: "04",
      nome: "Institucional Premium",
      descricao: "Site completo com identidade, CMS e área de conteúdo.",
      valor: 950,
      tag: "COMPLETO",
      inclui: [
        "Páginas ilimitadas",
        "CMS sob medida",
        "Design de identidade",
        "Otimização de performance",
      ],
    },
  ],
  horas: [
    { nome: "Hora avulsa", detalhe: "Sob demanda", valor: 18, unit: "18/h" },
    { nome: "Pacote 5 horas", detalhe: "Validade 90 dias", valor: 90, unit: "18/h" },
    {
      nome: "Pacote 10 horas",
      detalhe: "Validade 120 dias",
      valor: 170,
      unit: "17/h",
    },
  ],
  rodape: "Studio Exemplo · contato@studioexemplo.com · Documento de demonstração",
};

const ES: ConteudoDemo = {
  estudio: "Studio Exemplo",
  tagline: "Diseño & Desarrollo Web",
  intro:
    "Tabla de referencia de servicios y condiciones comerciales. Valores en dólares, sujetos a alcance cerrado en briefing.",
  moeda: "USD",
  fmt: USD("es-AR"),
  secoes: {
    servicosTitulo: "Servicios",
    bancoHorasTitulo: "Bolsa de Horas",
    bancoHorasSub: "Mantenimiento, ajustes y evoluciones post-entrega.",
    projetosTitulo: "Proyectos Especiales",
    projetosTexto:
      "E-commerce, sistemas a medida, identidad visual completa e integraciones. Alcance y plazo definidos tras la reunión de descubrimiento — presupuesto dedicado.",
    condicoesTitulo: "Condiciones Comerciales",
    condicoes: [
      "50% al aprobar, 50% en la entrega final.",
      "Plazo medio de 2 a 6 semanas según el paquete.",
      "Dos rondas de revisión incluidas en cada proyecto.",
      "Presupuesto válido por 15 días.",
    ],
  },
  landing: [
    {
      ordem: "01",
      nome: "Landing Page Simple",
      descricao: "Página única, foco en conversión, una sección principal.",
      valor: 280,
      inclui: ["Una sección hero + CTA", "Responsive", "Formulario de contacto"],
    },
    {
      ordem: "02",
      nome: "Landing Page Premium",
      descricao: "Página larga, animaciones de entrada, copy y SEO on-page.",
      valor: 420,
      tag: "MÁS PEDIDO",
      inclui: [
        "Múltiples secciones",
        "Animaciones en scroll",
        "SEO on-page",
        "Integración de analytics",
      ],
    },
  ],
  institucional: [
    {
      ordem: "03",
      nome: "Institucional Simple",
      descricao: "Sitio de presentación de hasta 5 páginas.",
      valor: 650,
      inclui: ["Hasta 5 páginas", "Blog opcional", "Panel de edición"],
    },
    {
      ordem: "04",
      nome: "Institucional Premium",
      descricao: "Sitio completo con identidad, CMS y área de contenido.",
      valor: 950,
      tag: "COMPLETO",
      inclui: [
        "Páginas ilimitadas",
        "CMS a medida",
        "Diseño de identidad",
        "Optimización de performance",
      ],
    },
  ],
  horas: [
    { nome: "Hora suelta", detalhe: "A demanda", valor: 18, unit: "18/h" },
    { nome: "Paquete 5 horas", detalhe: "Validez 90 días", valor: 90, unit: "18/h" },
    {
      nome: "Paquete 10 horas",
      detalhe: "Validez 120 días",
      valor: 170,
      unit: "17/h",
    },
  ],
  rodape:
    "Studio Exemplo · contacto@studioexemplo.com · Documento de demostración",
};

/** Conteúdo de demonstração no idioma pedido (default pt). */
export function conteudoDemo(idioma?: string): ConteudoDemo {
  return String(idioma ?? "").toLowerCase() === "es" ? ES : PT;
}
