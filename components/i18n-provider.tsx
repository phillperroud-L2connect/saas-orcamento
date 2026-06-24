"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase";
import { getDict, type Dict } from "@/lib/i18n";
import { fmtData, fmtMoeda, moedaDoTenant, simboloMoeda } from "@/lib/moeda";
import type { Idioma, MoedaPreferida } from "@/lib/types";

type I18nContextValue = {
  idioma: Idioma;
  moeda: MoedaPreferida;
  dict: Dict;
  /** Formata valor monetário na moeda do tenant. */
  fmt: (valor: number) => string;
  /** Formata data no idioma do tenant. */
  data: (valor: string | Date) => string;
  /** Símbolo curto da moeda do tenant (ex.: R$, $, US$). */
  simbolo: string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Carrega idioma + moeda do tenant logado uma única vez e expõe o dicionário
 * e os formatadores via contexto para os Client Components do dashboard.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [idioma, setIdioma] = useState<Idioma>("pt");
  const [moeda, setMoeda] = useState<MoedaPreferida>("BRL");

  useEffect(() => {
    const supabase = createClient();
    let ativo = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRow } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();
      const tId = userRow?.tenant_id as string | undefined;
      if (!tId) return;

      const { data: tenant } = await supabase
        .from("tenants")
        .select("idioma, moeda_preferida")
        .eq("id", tId)
        .single();
      if (!tenant || !ativo) return;

      setIdioma((tenant.idioma as Idioma) ?? "pt");
      setMoeda(
        moedaDoTenant(
          tenant as { idioma: Idioma; moeda_preferida: MoedaPreferida | null },
        ),
      );
    })();

    return () => {
      ativo = false;
    };
  }, []);

  const fmt = useCallback((valor: number) => fmtMoeda(valor, moeda), [moeda]);
  const data = useCallback(
    (valor: string | Date) => fmtData(valor, idioma),
    [idioma],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      idioma,
      moeda,
      dict: getDict(idioma),
      fmt,
      data,
      simbolo: simboloMoeda(moeda),
    }),
    [idioma, moeda, fmt, data],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Hook de acesso ao i18n do tenant. Default pt/BRL fora do provider. */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Fallback seguro (não deveria ocorrer dentro do dashboard).
  return {
    idioma: "pt",
    moeda: "BRL",
    dict: getDict("pt"),
    fmt: (v: number) => fmtMoeda(v, "BRL"),
    data: (v: string | Date) => fmtData(v, "pt"),
    simbolo: simboloMoeda("BRL"),
  };
}
