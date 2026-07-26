/**
 * Tipagem do núcleo puro da feature "esconder blocos" (lib/blocos-core.js).
 *
 * O runtime mora no .js (importável por `node --test` sem build); este .d.ts dá
 * ao TypeScript os ids de bloco por template e as assinaturas das funções que o
 * render e a UI de toggles consomem.
 */

import type { TemplateId } from "./templates-core";

/** Id de um bloco (seção) dentro de um template. */
export type BlocoId = string;

/** Ordem canônica dos blocos de cada template. */
export const BLOCOS_TEMPLATE: Record<TemplateId, BlocoId[]>;

/**
 * Blocos ocultos por padrão (default de projeto, não dado do banco). Só os
 * templates que têm blocos sem fonte de dado aparecem aqui.
 */
export const BLOCOS_PADRAO_OCULTOS: Partial<Record<TemplateId, BlocoId[]>>;

export function blocosDoTemplate(templateId: unknown): BlocoId[];

export function normalizarOcultos(
  templateId: unknown,
  ocultos: unknown,
): BlocoId[];

export function estaOculto(
  templateId: unknown,
  ocultos: unknown,
  blocoId: BlocoId,
): boolean;

export function resolverBlocos(
  templateId: unknown,
  ocultos: unknown,
): BlocoId[];
