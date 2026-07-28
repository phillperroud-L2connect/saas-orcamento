/**
 * Tipagem dos rótulos legíveis de bloco (lib/blocos-rotulos.js).
 *
 * Camada de apresentação da UI de toggles: dá ao TypeScript o formato do mapa e
 * a assinatura do helper que a tela consome para exibir o nome amigável no lugar
 * do blocoId técnico.
 */

import type { BlocoId } from "./blocos-core";

export type IdiomaRotulo = "pt" | "es";

/** Rótulo de cada blocoId nos dois idiomas suportados. */
export const ROTULOS_BLOCOS: Record<BlocoId, Record<IdiomaRotulo, string>>;

export function rotuloBloco(blocoId: unknown, idioma?: IdiomaRotulo): string;
