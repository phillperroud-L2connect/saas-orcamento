/**
 * Internacionalização da página pública de checkout (PT / ES).
 *
 * O idioma é lido do parâmetro `?lang=` da URL (ex.: /checkout/pro?lang=es).
 * Default: português. Mantém todos os textos da tela — títulos, labels,
 * botões e mensagens — centralizados aqui como única fonte da verdade.
 *
 * Escopo: apenas o checkout. Não altera planos.ts, middleware, admin ou auth.
 */

import type { PlanoId } from "@/lib/planos";

export type Lang = "pt" | "es";

/** Normaliza o valor de `?lang=` para um idioma suportado (default: pt). */
export function resolverLang(valor?: string | string[]): Lang {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return v?.toLowerCase() === "es" ? "es" : "pt";
}

/** Locale do Wallet Brick do Mercado Pago conforme o idioma escolhido. */
export function localeMercadoPago(lang: Lang): string {
  return lang === "es" ? "es-AR" : "pt-BR";
}

type Textos = {
  metaTitle: (nome: string) => string;
  metaCheckout: string;

  eyebrow: string;
  planoLabel: string;

  mensal: string;
  anual: string;
  badge2meses: string;
  porAno: string;
  porMes: string;
  equivalente: (valor: string) => string;

  seusDados: string;
  seusDadosSubtitulo: string;
  pagamentoSeguro: string;

  nomeLabel: string;
  nomePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  emailHint: string;
  whatsappLabel: string;
  whatsappOpcional: string;
  whatsappPlaceholder: string;

  btnIr: string;
  btnPreparando: string;

  erroNomeEmail: string;
  erroIniciar: string;
  erroConexao: string;

  saudacao: string;
  finalizeAbaixo: string;
  botaoNaoApareceu: string;
};

export const TEXTOS: Record<Lang, Textos> = {
  pt: {
    metaTitle: (nome) => `Contratar plano ${nome}`,
    metaCheckout: "Checkout",

    eyebrow: "Checkout",
    planoLabel: "Plano",

    mensal: "Mensal",
    anual: "Anual",
    badge2meses: "2 MESES GRÁTIS",
    porAno: "/ ano",
    porMes: "/ mês",
    equivalente: (valor) =>
      `Equivale a ${valor}/mês — você economiza 2 meses no plano anual.`,

    seusDados: "Seus dados",
    seusDadosSubtitulo: "Preencha para continuar ao pagamento seguro.",
    pagamentoSeguro: "Pagamento processado com segurança pelo Mercado Pago.",

    nomeLabel: "Nome completo *",
    nomePlaceholder: "Como devemos te chamar",
    emailLabel: "E-mail *",
    emailPlaceholder: "voce@email.com",
    emailHint: "É aqui que enviaremos o acesso à sua conta.",
    whatsappLabel: "WhatsApp",
    whatsappOpcional: "(opcional)",
    whatsappPlaceholder: "+54 9 11 1234-5678",

    btnIr: "Ir para o pagamento",
    btnPreparando: "Preparando pagamento...",

    erroNomeEmail: "Preencha nome e e-mail.",
    erroIniciar: "Não foi possível iniciar o pagamento.",
    erroConexao: "Erro de conexão. Tente novamente.",

    saudacao: "Tudo certo, ",
    finalizeAbaixo: "Finalize o pagamento abaixo:",
    botaoNaoApareceu: "O botão não apareceu? Pagar pelo Mercado Pago →",
  },
  es: {
    metaTitle: (nome) => `Contratar plan ${nome}`,
    metaCheckout: "Checkout",

    eyebrow: "Checkout",
    planoLabel: "Plan",

    mensal: "Mensual",
    anual: "Anual",
    badge2meses: "2 MESES GRATIS",
    porAno: "/ año",
    porMes: "/ mes",
    equivalente: (valor) =>
      `Equivale a ${valor}/mes — ahorrás 2 meses en el plan anual.`,

    seusDados: "Tus datos",
    seusDadosSubtitulo: "Completá para continuar al pago seguro.",
    pagamentoSeguro: "Pago procesado de forma segura por Mercado Pago.",

    nomeLabel: "Nombre completo *",
    nomePlaceholder: "¿Cómo te llamamos?",
    emailLabel: "Correo electrónico *",
    emailPlaceholder: "vos@email.com",
    emailHint: "Aquí te enviaremos el acceso a tu cuenta.",
    whatsappLabel: "WhatsApp",
    whatsappOpcional: "(opcional)",
    whatsappPlaceholder: "+54 9 11 1234-5678",

    btnIr: "Ir al pago",
    btnPreparando: "Preparando el pago...",

    erroNomeEmail: "Completá nombre y correo electrónico.",
    erroIniciar: "No fue posible iniciar el pago.",
    erroConexao: "Error de conexión. Intentá de nuevo.",

    saudacao: "Todo listo, ",
    finalizeAbaixo: "Finalizá el pago abajo:",
    botaoNaoApareceu: "¿No apareció el botón? Pagar con Mercado Pago →",
  },
};

/**
 * Conteúdo dos planos por idioma (descrição e recursos). A versão PT espelha
 * planos.ts — que segue sendo a fonte da verdade de preços/ids. O nome do
 * plano ("Básico"/"Pro") é igual nos dois idiomas, então vem direto do plano.
 */
const PLANO_TEXTOS: Record<
  Lang,
  Record<PlanoId, { descricao: string; recursos: string[] }>
> = {
  pt: {
    basico: {
      descricao:
        "Para profissionais que estão começando a organizar seus orçamentos.",
      recursos: [
        "Orçamentos ilimitados",
        "Exportação em PDF",
        "Catálogo de serviços",
        "1 usuário",
      ],
    },
    pro: {
      descricao: "Para quem precisa de mais controle, marca e relatórios.",
      recursos: [
        "Tudo do plano Básico",
        "Personalização da marca (logo e cor)",
        "Dashboard financeiro",
        "Templates de orçamento",
        "Suporte prioritário",
      ],
    },
  },
  es: {
    basico: {
      descricao:
        "Para profesionales que están empezando a organizar sus presupuestos.",
      recursos: [
        "Presupuestos ilimitados",
        "Exportación en PDF",
        "Catálogo de servicios",
        "1 usuario",
      ],
    },
    pro: {
      descricao: "Para quienes necesitan más control, marca e informes.",
      recursos: [
        "Todo lo del plan Básico",
        "Personalización de marca (logo y color)",
        "Dashboard financiero",
        "Plantillas de presupuesto",
        "Soporte prioritario",
      ],
    },
  },
};

/** Retorna descrição e recursos do plano no idioma escolhido. */
export function getPlanoTextos(planoId: PlanoId, lang: Lang) {
  return PLANO_TEXTOS[lang][planoId];
}
