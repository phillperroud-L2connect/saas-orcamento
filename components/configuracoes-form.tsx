"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Save } from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { Tenant } from "@/lib/types";

const inputCls =
  "w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900";
const labelCls =
  "block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1";

/** Cor padrão (igual ao fallback usado no gerador de orçamentos). */
const COR_PADRAO = "#0F0F0F";

/** Normaliza qualquer string para um hex #RRGGBB válido, ou null se inválida. */
function normalizarHex(valor: string): string | null {
  let v = valor.trim();
  if (!v.startsWith("#")) v = `#${v}`;
  // Expande #abc -> #aabbcc
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : null;
}

export function ConfiguracoesForm() {
  const supabase = createClient();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Campo de cor (texto livre) + o último hex válido derivado dele.
  const [corTexto, setCorTexto] = useState(COR_PADRAO);
  const hexValido = normalizarHex(corTexto);
  const corPreview = hexValido ?? COR_PADRAO;

  const carregarContexto = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setCarregando(false);
      return;
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const tId = userRow?.tenant_id as string | undefined;
    if (!tId) {
      setCarregando(false);
      return;
    }
    setTenantId(tId);

    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", tId)
      .single();
    if (tenantRow) {
      const tt = tenantRow as Tenant;
      setTenant(tt);
      setCorTexto(tt.cor_primaria || COR_PADRAO);
    }
    setCarregando(false);
  }, [supabase]);

  useEffect(() => {
    carregarContexto();
  }, [carregarContexto]);

  async function salvar() {
    setErro(null);
    if (!tenantId) {
      setErro("Não foi possível identificar seu tenant. Refaça o login.");
      return;
    }
    const hex = normalizarHex(corTexto);
    if (!hex) {
      setErro("Informe uma cor hexadecimal válida (ex.: #1D4ED8).");
      return;
    }

    setSalvando(true);
    const { error } = await supabase
      .from("tenants")
      .update({ cor_primaria: hex })
      .eq("id", tenantId);
    setSalvando(false);

    if (error) {
      console.error("[ConfiguracoesForm] erro ao salvar cor:", error);
      setErro("Não foi possível salvar a cor.");
      return;
    }
    setCorTexto(hex);
    setSalvo(true);
  }

  if (carregando) {
    return (
      <p className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
        Carregando...
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Personalize a cor da sua marca usada nos orçamentos em PDF.
        </p>
      </div>

      {/* Seletor de cor */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Cor da marca
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Essa cor é aplicada automaticamente no template{" "}
          <strong>Moderno</strong> do PDF (cabeçalho, total e destaques).
        </p>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="cor_picker" className={labelCls}>
              Seletor
            </label>
            <input
              id="cor_picker"
              type="color"
              value={corPreview}
              onChange={(e) => {
                setCorTexto(e.target.value);
                setSalvo(false);
              }}
              className="h-11 w-16 cursor-pointer rounded-lg border border-gray-300 bg-white p-1 dark:border-gray-700 dark:bg-gray-800"
            />
          </div>

          <div className="w-40">
            <label htmlFor="cor_hex" className={labelCls}>
              Código hexadecimal
            </label>
            <input
              id="cor_hex"
              className={inputCls}
              value={corTexto}
              onChange={(e) => {
                setCorTexto(e.target.value);
                setSalvo(false);
              }}
              placeholder="#1D4ED8"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="flex items-center gap-2">
            <span
              className="inline-block size-11 rounded-lg border border-gray-200 shadow-sm dark:border-gray-700"
              style={{ background: corPreview }}
              aria-hidden
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {hexValido ? "Prévia da cor" : "Hex inválido — usando padrão"}
            </span>
          </div>
        </div>
      </section>

      {/* Prévia: mini-cabeçalho do template Moderno com a cor escolhida */}
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Prévia no PDF (Moderno)
        </h3>
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <div
            style={{
              background: corPreview,
              color: "#fff",
              padding: "20px 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "18px", fontWeight: 800 }}>
              {tenant?.nome_empresa || "Sua Empresa"}
            </span>
            <span
              style={{
                fontSize: "16px",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "2px",
              }}
            >
              Orçamento
            </span>
          </div>
          <div
            className="flex items-center justify-between bg-white px-6 py-4 dark:bg-white"
            style={{ color: "#111" }}
          >
            <span style={{ fontSize: "13px", color: "#555" }}>Total</span>
            <span style={{ fontSize: "20px", fontWeight: 800, color: corPreview }}>
              R$ 1.250,00
            </span>
          </div>
        </div>
      </section>

      {erro && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {erro}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando || !hexValido}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
        >
          {salvo ? <Check className="size-4" /> : <Save className="size-4" />}
          {salvando ? "Salvando..." : salvo ? "Salvo" : "Salvar cor"}
        </button>
      </div>
    </div>
  );
}
