/**
 * Tipagem do nome de exibição localizado do plano (lib/planos-nomes.js).
 * Runtime no .js (importável por `node --test` sem build); tipos aqui.
 */

import type { PlanoId } from "./planos";

export function nomePlanoLocalizado(
  planoId: PlanoId | string,
  lang: "pt" | "es" | string,
): string;
