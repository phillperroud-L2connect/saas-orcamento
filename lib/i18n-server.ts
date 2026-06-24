/**
 * Resolve idioma, moeda e dicionário do tenant logado em Server Components.
 * Usa o cliente Supabase read-only baseado nos cookies da requisição.
 */
import { createServerSupabase } from "./supabase-server";
import { getDict, type Dict } from "./i18n";
import { moedaDoTenant } from "./moeda";
import type { Idioma, MoedaPreferida } from "./types";

export type TenantI18n = {
  idioma: Idioma;
  moeda: MoedaPreferida;
  dict: Dict;
};

export async function getTenantI18n(): Promise<TenantI18n> {
  const supabase = createServerSupabase();

  let idioma: Idioma = "pt";
  let moeda: MoedaPreferida = "BRL";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: userRow } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    const tId = userRow?.tenant_id as string | undefined;

    if (tId) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("idioma, moeda_preferida")
        .eq("id", tId)
        .single();
      if (tenant) {
        idioma = (tenant.idioma as Idioma) ?? "pt";
        moeda = moedaDoTenant(tenant as { idioma: Idioma; moeda_preferida: MoedaPreferida | null });
      }
    }
  }

  return { idioma, moeda, dict: getDict(idioma) };
}
