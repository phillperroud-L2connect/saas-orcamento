/**
 * Tipagem do núcleo puro multi-país (lib/mp-paises.js).
 *
 * O runtime mora no .js (importável por `node --test` sem build); este .d.ts dá
 * ao TypeScript os tipos literais precisos (Pais, moedas, etc.) que a inferência
 * de JS não capturaria sozinha.
 */

import type { Pais, Idioma } from "./types";

export type MoedaAssinatura = "ARS" | "BRL";
export type Periodo = "mensal" | "anual";
export type PlanoId = "basico" | "pro";

export const PAISES: Pais[];

export function normalizarPais(valor: unknown, padrao?: Pais): Pais;
export function moedaAssinatura(pais: unknown): MoedaAssinatura;
export function idiomaDoPais(pais: unknown): Idioma;
export function paisDoIdioma(idioma: unknown): Pais;
export function idiomaPorPaisIp(countryCode: unknown): Idioma;
export function authDomainMp(pais: unknown): string;
export function localeAssinatura(pais: unknown): string;
export function configFormatoMoeda(moeda: unknown): {
  locale: string;
  currency: MoedaAssinatura;
  maximumFractionDigits: number;
};

export const PRECOS_ASSINATURA: Record<
  PlanoId,
  Record<Pais, { mensal: number; anual: number }>
>;

export function precoAssinatura(
  planoId: string,
  periodo: Periodo | string,
  pais?: unknown,
): number | null;
