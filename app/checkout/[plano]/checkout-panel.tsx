"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import {
  formatarPreco,
  getPrecoPorPeriodo,
  equivalenteMensalAnual,
  type Periodo,
  type Plano,
} from "@/lib/planos";
import type { Pais } from "@/lib/types";
import { CheckoutForm } from "./checkout-form";
import { TEXTOS, getPlanoTextos, type Lang } from "./i18n";

type Props = {
  plano: Plano;
  lang: Lang;
  pais: Pais;
  publicKey: string;
};

/**
 * Painel interativo do checkout. Mantém o período selecionado (mensal/anual)
 * para que ele controle, ao mesmo tempo, o preço exibido no resumo e o valor
 * enviado ao Mercado Pago pelo formulário.
 */
export function CheckoutPanel({ plano, lang, pais, publicKey }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>("mensal");

  const t = TEXTOS[lang];
  const planoTextos = getPlanoTextos(plano.id, lang);

  const preco = getPrecoPorPeriodo(plano, periodo, pais);
  const ehAnual = periodo === "anual";
  // Anual = 10 meses (2 grátis). Equivalente mensal para reforçar a economia.
  const equivalenteMensal = equivalenteMensalAnual(plano, pais);

  return (
    <div className="relative mx-auto grid max-w-5xl gap-10 px-5 py-12 lg:grid-cols-[1.1fr_1fr] lg:py-20">
      {/* ----------------------------- Resumo do plano ---------------------- */}
      <section className="lg:pr-8">
        <p
          className="inline-flex items-center gap-2.5 text-xs font-medium uppercase tracking-[0.18em] text-[#6ee0ff]"
          style={{ fontFamily: "var(--font-l2-mono), monospace" }}
        >
          <span className="h-px w-6 bg-[#6ee0ff]" />
          {t.eyebrow}
        </p>

        <h1 className="mt-5 text-5xl font-medium leading-[0.95] tracking-tight sm:text-6xl">
          {t.planoLabel}
          <br />
          <span
            style={{
              backgroundImage:
                "linear-gradient(100deg, #6ee0ff 0%, #3ea6ff 55%, #8a9bff 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {planoTextos.nome}
          </span>
        </h1>

        <p className="mt-5 max-w-sm text-sm leading-relaxed text-[#aab4c8]">
          {planoTextos.descricao}
        </p>

        {/* ------------------------- Toggle mensal/anual -------------------- */}
        <div className="mt-9 inline-flex items-center rounded-full border border-[rgba(120,160,230,0.18)] bg-[rgba(120,160,230,0.05)] p-1">
          {(["mensal", "anual"] as const).map((opt) => {
            const ativo = periodo === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setPeriodo(opt)}
                aria-pressed={ativo}
                className={`relative rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 ${
                  ativo ? "text-white" : "text-[#aab4c8] hover:text-[#e8edf7]"
                }`}
                style={
                  ativo
                    ? {
                        backgroundImage:
                          "linear-gradient(135deg, #3ea6ff 0%, #1a5cff 100%)",
                        boxShadow:
                          "0 6px 20px rgba(62,166,255,0.30), inset 0 1px 0 rgba(255,255,255,0.2)",
                      }
                    : undefined
                }
              >
                {opt === "mensal" ? t.mensal : t.anual}
                {opt === "anual" && (
                  <span
                    className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${
                      ativo
                        ? "bg-white/20 text-white"
                        : "bg-[#3ea6ff]/15 text-[#6ee0ff]"
                    }`}
                  >
                    {t.badge2meses}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ------------------------------ Preço ----------------------------- */}
        <div className="mt-8 flex items-end gap-2">
          <span className="text-5xl font-medium tracking-tight text-[#e8edf7]">
            {formatarPreco(preco, pais)}
          </span>
          <span className="mb-1.5 text-sm text-[#6a7490]">
            {ehAnual ? t.porAno : t.porMes}
          </span>
        </div>
        {ehAnual && (
          <p className="mt-2 text-xs text-[#6ee0ff]">
            {t.equivalente(formatarPreco(equivalenteMensal, pais))}
          </p>
        )}

        <ul className="mt-8 space-y-3">
          {planoTextos.recursos.map((r) => (
            <li
              key={r}
              className="flex items-center gap-3 text-sm text-[#aab4c8]"
            >
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#3ea6ff]/15">
                <Check className="size-3 text-[#3ea6ff]" />
              </span>
              {r}
            </li>
          ))}
        </ul>
      </section>

      {/* ----------------------------- Formulário --------------------------- */}
      <section className="lg:pl-2">
        <div
          className="rounded-[22px] border border-[rgba(120,160,230,0.18)] bg-[rgba(120,160,230,0.04)] p-6 backdrop-blur-sm sm:p-8"
          style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.45)" }}
        >
          <h2 className="text-lg font-medium text-[#e8edf7]">{t.seusDados}</h2>
          <p className="mt-1 text-sm text-[#6a7490]">
            {t.seusDadosSubtitulo}
          </p>
          <CheckoutForm
            plano={plano.id}
            periodo={periodo}
            lang={lang}
            pais={pais}
            publicKey={publicKey}
          />
        </div>
        <p className="mt-4 text-center text-xs text-[#6a7490]">
          {t.pagamentoSeguro}
        </p>
      </section>
    </div>
  );
}
