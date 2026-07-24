/**
 * Tipagem do núcleo puro dos templates (lib/templates-core.js).
 *
 * O runtime mora no .js (importável por `node --test` sem build); este .d.ts dá
 * ao TypeScript os tipos literais que a inferência de JS não capturaria —
 * sobretudo os ids de template e o formato do tema derivado, que os componentes
 * de PDF consomem campo a campo.
 */

import type { PlanoContratado } from "./types";

/** Os três templates originais, livres para qualquer plano. */
export type TemplateLivre = "classico" | "moderno" | "simples";

/** Os três templates premium do segmento web designer (exclusivos do Max). */
export type TemplateMax = "atelier_noir" | "blueprint_tecnico" | "swiss_studio";

export type TemplateId = TemplateLivre | TemplateMax;

export type Rgb = { r: number; g: number; b: number };
export type Hsl = { h: number; s: number; l: number };

// --- matemática de cor ------------------------------------------------------
export function normalizarHex(valor: unknown, padrao?: null): string | null;
export function normalizarHex(valor: unknown, padrao: string): string;
export function hexParaRgb(hex: string): Rgb;
export function rgbParaHex(rgb: Rgb): string;
export function rgbParaHsl(rgb: Rgb): Hsl;
export function hslParaRgb(hsl: Hsl): Rgb;
export function misturar(base: string, alvo: string, pct: number): string;
export function elevar(hex: string, deltaL: number, deltaS?: number): string;
export function luminancia(hex: string): number;
export function contraste(a: string, b: string): number;
export function ehEscuro(hex: string): boolean;
export function melhorContraste(
  fundo: string,
  candidatos: (string | null | undefined)[],
): string;
export function garantirContraste(
  cor: string,
  fundo: string,
  minimo?: number,
): string;

// --- catálogo e gating ------------------------------------------------------
export type TemplateInfo = {
  id: TemplateId;
  /** Plano exigido, ou `null` quando o template é livre. */
  planoExigido: "max" | null;
  premium: boolean;
};

export const TEMPLATES: Record<TemplateId, TemplateInfo>;
export const TEMPLATES_ORDEM: TemplateId[];
export const TEMPLATES_MAX: TemplateMax[];
export const TEMPLATE_PADRAO: TemplateLivre;

export function isTemplateId(valor: unknown): valor is TemplateId;
export function planoDoTemplate(templateId: unknown): "max" | null;
export function podeUsarTemplate(
  plano: PlanoContratado | null | undefined,
  templateId: unknown,
): boolean;
export function templatesDisponiveis(
  plano: PlanoContratado | null | undefined,
): TemplateId[];
export function resolverTemplate(
  plano: PlanoContratado | null | undefined,
  templateId: unknown,
): TemplateId;

// --- paletas ----------------------------------------------------------------
export type PaletaAtelier = {
  fundo: string;
  texto: string;
  dourado: string;
  vinho: string;
};
export type PaletaBlueprint = {
  fundo: string;
  texto: string;
  ciano: string;
  ambar: string;
};
export type PaletaSwiss = { fundo: string; tinta: string; vermelho: string };
export type Paleta = PaletaAtelier | PaletaBlueprint | PaletaSwiss;

/**
 * Overrides de cor gravados pelo tenant (coluna jsonb `paleta_templates`).
 * Parcial em dois níveis: o tenant pode ter customizado só um template, e
 * dentro dele só um token.
 */
export type PaletaOverrides = Partial<
  Record<TemplateMax, Record<string, string>>
>;

export const PALETAS_PADRAO: Record<TemplateMax, Paleta>;
export const PALETA_TOKENS: Record<TemplateMax, string[]>;

export function paletaEfetiva(
  templateId: unknown,
  overrides: PaletaOverrides | null | undefined,
): Paleta | null;

/**
 * Tema derivado que os componentes de template consomem. Todo campo aqui é
 * calculado a partir dos poucos tokens editáveis — nenhum componente inventa
 * cor, e é neste ponto único que o piso de contraste é aplicado.
 */
export type TemaTemplate = {
  paleta: Paleta;
  fundo: string;
  superficie: string;
  superficieAlta: string;
  texto: string;
  textoSuave: string;
  acento: string;
  acentoClaro: string;
  acentoTexto: string;
  acentoTextoGrande: string;
  sobreAcento: string;
  secundario: string;
  secundarioTexto: string;
  sobreSecundario: string;
  hairline: string;
  divisor: string;
  raio: string;
  /** Só no Blueprint Técnico: cor dos pontos da malha do fundo. */
  grade?: string;
  /** Só no Swiss Studio: cor da numeração de seção em outline. */
  outline?: string;
};

export function derivarTema(
  templateId: unknown,
  overrides: PaletaOverrides | null | undefined,
): TemaTemplate | null;
