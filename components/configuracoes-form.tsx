"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Save } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
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
  const { dict, fmt, moeda, simbolo } = useI18n();

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
      setErro(dict.orc.erroTenant);
      return;
    }
    const hex = normalizarHex(corTexto);
    if (!hex) {
      setErro(dict.cfg.erroHex);
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
      setErro(dict.cfg.erroSalvar);
      return;
    }
    setCorTexto(hex);
    setSalvo(true);
  }

  if (carregando) {
    return (
      <p className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
        {dict.common.carregando}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {dict.cfg.titulo}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {dict.cfg.subtitulo}
        </p>
      </div>

      {/* Idioma e moeda (somente leitura — definidos pelo admin) */}
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {dict.cfg.regional}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {dict.cfg.regionalDesc}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {dict.cfg.idiomaLabel}
            </div>
            <div className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
              {dict.cfg.idiomaNome}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {dict.cfg.moedaLabel}
            </div>
            <div className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
              {moeda} ({simbolo})
            </div>
          </div>
        </div>
      </section>

      {/* Seletor de cor */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {dict.cfg.corMarca}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {dict.cfg.corMarcaDescA}
          <strong>{dict.cfg.templateModerno}</strong>
          {dict.cfg.corMarcaDescB}
        </p>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="cor_picker" className={labelCls}>
              {dict.cfg.seletor}
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
              {dict.cfg.codigoHex}
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
              {hexValido ? dict.cfg.previaCor : dict.cfg.hexInvalido}
            </span>
          </div>
        </div>
      </section>

      {/* Prévia: mini-cabeçalho do template Moderno com a cor escolhida */}
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {dict.cfg.previaPdf}
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
              {dict.pdf.titulo}
            </span>
          </div>
          <div
            className="flex items-center justify-between bg-white px-6 py-4 dark:bg-white"
            style={{ color: "#111" }}
          >
            <span style={{ fontSize: "13px", color: "#555" }}>
              {dict.pdf.total}
            </span>
            <span style={{ fontSize: "20px", fontWeight: 800, color: corPreview }}>
              {fmt(1250)}
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
          {salvando
            ? dict.common.salvando
            : salvo
            ? dict.common.salvo
            : dict.cfg.salvarCor}
        </button>
      </div>
    </div>
  );
}
