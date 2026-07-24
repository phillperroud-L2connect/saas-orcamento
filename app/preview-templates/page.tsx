"use client";

/**
 * Rota de PREVIEW dos três templates premium (segmento web designer, Plano Max).
 *
 * Finalidade: revisão visual e demonstração. Não há autenticação nem dados de
 * cliente — cada template renderiza o conteúdo fictício "Studio Exemplo". Os
 * seletores de cor no topo de cada template editam APENAS os tokens do :root
 * equivalente (2–6 por template); todo o resto (superfícies, bordas, tons de
 * apoio, contraste do texto) é recalculado ao vivo por `derivarTema`, provando
 * que trocar as cores não quebra o documento. É o mesmo núcleo que o seletor de
 * cor real das Configurações vai consumir.
 *
 * `noindex` no metadata do layout não se aplica a client component; a rota é
 * apenas de trabalho interno e o conteúdo é 100% fictício.
 */
import { useMemo, useState } from "react";
import {
  derivarTema,
  PALETAS_PADRAO,
  PALETA_TOKENS,
  type PaletaOverrides,
} from "@/lib/templates-core";
import { FONTES } from "@/lib/fontes-templates";
import { TEMPLATES_PREMIUM } from "@/components/templates-premium";

type TemplateMax = keyof typeof TEMPLATES_PREMIUM;

const META: Record<TemplateMax, { nome: string; nota: string }> = {
  atelier_noir: {
    nome: "Atelier Noir",
    nota: "Editorial de luxo · Playfair Display + DM Sans",
  },
  blueprint_tecnico: {
    nome: "Blueprint Técnico",
    nota: "Spec sheet · Space Grotesk + JetBrains Mono",
  },
  swiss_studio: {
    nome: "Swiss Studio",
    nota: "Cartaz suíço · Archivo 900 + Archivo Narrow",
  },
};

/** Rótulos amigáveis dos tokens de cada template. */
const TOKEN_LABEL: Record<string, string> = {
  fundo: "Fundo",
  texto: "Texto",
  tinta: "Tinta",
  dourado: "Dourado",
  vinho: "Vinho",
  ciano: "Ciano",
  ambar: "Âmbar",
  vermelho: "Vermelho",
};

const ORDEM: TemplateMax[] = ["atelier_noir", "blueprint_tecnico", "swiss_studio"];

function PainelTemplate({
  id,
  idioma,
}: {
  id: TemplateMax;
  idioma: "pt" | "es";
}) {
  const [cores, setCores] = useState<Record<string, string>>(() => ({
    ...(PALETAS_PADRAO[id] as Record<string, string>),
  }));

  const overrides: PaletaOverrides = useMemo(
    () => ({ [id]: cores }) as PaletaOverrides,
    [id, cores],
  );

  const tema = useMemo(() => derivarTema(id, overrides), [id, overrides]);
  const Componente = TEMPLATES_PREMIUM[id];
  const meta = META[id];

  if (!tema) return null;

  return (
    <section id={id} style={{ marginBottom: "56px", scrollMarginTop: "24px" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          marginBottom: "14px",
        }}
      >
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#f0f0f0" }}>
            {meta.nome}
          </h2>
          <p style={{ fontSize: "13px", color: "#8a8a8a", marginTop: "2px" }}>
            {meta.nota}
          </p>
        </div>
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
          {PALETA_TOKENS[id].map((token) => (
            <label
              key={token}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                color: "#bbb",
              }}
            >
              <input
                type="color"
                value={cores[token]}
                onChange={(e) =>
                  setCores((c) => ({ ...c, [token]: e.target.value }))
                }
                style={{
                  width: "28px",
                  height: "28px",
                  border: "1px solid #333",
                  borderRadius: "6px",
                  background: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
              {TOKEN_LABEL[token] ?? token}
            </label>
          ))}
          <button
            type="button"
            onClick={() =>
              setCores({ ...(PALETAS_PADRAO[id] as Record<string, string>) })
            }
            style={{
              fontSize: "11px",
              color: "#bbb",
              border: "1px solid #333",
              borderRadius: "6px",
              padding: "0 12px",
              background: "none",
              cursor: "pointer",
            }}
          >
            Resetar
          </button>
        </div>
      </div>

      {/* Folha A4 (210mm) centralizada — mesma proporção que o PDF gerado. */}
      <div
        style={{
          width: "210mm",
          maxWidth: "100%",
          margin: "0 auto",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        <Componente tema={tema} fontes={FONTES} idioma={idioma} />
      </div>
    </section>
  );
}

export default function PreviewTemplatesPage() {
  const [idioma, setIdioma] = useState<"pt" | "es">("pt");

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b0b0c",
        padding: "40px 24px 80px",
      }}
    >
      <div style={{ maxWidth: "210mm", margin: "0 auto 32px" }}>
        <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#fff" }}>
          Templates premium — Plano Max
        </h1>
        <p style={{ fontSize: "14px", color: "#8a8a8a", marginTop: "6px" }}>
          Conteúdo fictício (Studio Exemplo). Edite os tokens de cor de cada
          template — superfícies, bordas e contraste se recalculam sozinhos.
        </p>
        <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
          {(["pt", "es"] as const).map((lng) => (
            <button
              key={lng}
              type="button"
              onClick={() => setIdioma(lng)}
              style={{
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "1px",
                textTransform: "uppercase",
                padding: "6px 14px",
                borderRadius: "6px",
                cursor: "pointer",
                border: "1px solid #333",
                background: idioma === lng ? "#fff" : "none",
                color: idioma === lng ? "#000" : "#bbb",
              }}
            >
              {lng}
            </button>
          ))}
        </div>
      </div>

      {ORDEM.map((id) => (
        <PainelTemplate key={id} id={id} idioma={idioma} />
      ))}
    </main>
  );
}
