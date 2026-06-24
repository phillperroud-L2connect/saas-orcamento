/**
 * Helpers de moeda e formatação regional do app do tenant.
 *
 * A moeda é definida pelo admin na criação/edição do tenant:
 *   - idioma "pt" -> sempre BRL (R$)
 *   - idioma "es" -> moeda_preferida escolhida (ARS ou USD)
 */
import type { Idioma, MoedaPreferida, Tenant } from "./types";

type TenantMoeda = Pick<Tenant, "idioma" | "moeda_preferida"> | null | undefined;

/** Resolve a moeda efetiva do tenant a partir do idioma + moeda_preferida. */
export function moedaDoTenant(tenant: TenantMoeda): MoedaPreferida {
  if (!tenant) return "BRL";
  if (tenant.idioma === "pt") return "BRL";
  return tenant.moeda_preferida ?? "ARS";
}

/** Locale usado para formatar valores de cada moeda. */
const LOCALE_MOEDA: Record<MoedaPreferida, string> = {
  BRL: "pt-BR",
  ARS: "es-AR",
  USD: "en-US",
};

/** Locale de datas conforme o idioma do app. */
const LOCALE_DATA: Record<Idioma, string> = {
  pt: "pt-BR",
  es: "es-AR",
};

/** Símbolo curto da moeda (para placeholders e rótulos). */
export function simboloMoeda(moeda: MoedaPreferida): string {
  switch (moeda) {
    case "BRL":
      return "R$";
    case "ARS":
      return "$";
    case "USD":
      return "US$";
  }
}

/** Formata um valor monetário no padrão da moeda escolhida. */
export function fmtMoeda(valor: number, moeda: MoedaPreferida): string {
  try {
    return new Intl.NumberFormat(LOCALE_MOEDA[moeda], {
      style: "currency",
      currency: moeda,
    }).format(valor || 0);
  } catch {
    return `${simboloMoeda(moeda)} ${(valor || 0).toFixed(2)}`;
  }
}

/** Formata uma data (ISO ou Date) no padrão do idioma do tenant. */
export function fmtData(valor: string | Date, idioma: Idioma): string {
  const d = typeof valor === "string" ? new Date(valor) : valor;
  return d.toLocaleDateString(LOCALE_DATA[idioma], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
