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
import {
  TEMPLATES_PREMIUM,
  TemplateAtelierNoir,
  TemplateBlueprintTecnico,
  TemplateSwissStudio,
} from "@/components/templates-premium";
import { getDict } from "@/lib/i18n";
import type { TemplateProps } from "@/components/orcamento-templates";
import type { FormState, PlanoPagamento } from "@/components/orcamentos-manager";
import type { Tenant } from "@/lib/types";

type TemplatePremium = keyof typeof TEMPLATES_PREMIUM;

/**
 * Orçamento de exemplo para os templates premium (todos convertidos: Atelier 3a,
 * Blueprint 3b, Swiss 3c).
 * O showcase deixa de mostrar o menu fictício e passa a mostrar o layout de
 * orçamento real — o editor de paleta continua provando que trocar cor não
 * quebra o documento. `idioma` só troca a moeda/rótulos do exemplo.
 */
function exemploOrcamento(idioma: "pt" | "es"): TemplateProps {
  const dict = getDict(idioma);
  const moeda = idioma === "es" ? "ARS" : "BRL";
  const locale = idioma === "es" ? "es-AR" : "pt-BR";
  const fmt = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: moeda }).format(
      v || 0,
    );
  const servicos = [
    { id: "1", descricao: "Landing page institucional (5 seções)", valor: "6500" },
    { id: "2", descricao: "Integração de formulário + e-mail", valor: "2000" },
    { id: "3", descricao: "SEO técnico e performance", valor: "4000" },
  ];
  const total = 12500;
  const form = {
    cliente_id: "c1",
    cliente_nome: "Maria Fernanda Oliveira",
    cliente_email: "maria.oliveira@exemplo.com",
    cliente_telefone: "(11) 98888-1234",
    cliente_documento: "",
    cliente_endereco: "",
    servicos,
    nota: "Valores válidos por 15 dias. Não inclui domínio nem hospedagem.",
    opcao_pagamento: "entrada_restante",
    percentual_entrada: "50",
    parcelas: "3",
    tipo_parcelamento: "iguais",
    entrada_tipo: "percentual",
    entrada_valor: "30",
    template: "classico",
  } as unknown as FormState;
  const plano: PlanoPagamento = {
    tipo: "entrada_restante",
    pct: 50,
    entrada: total * 0.5,
    restante: total * 0.5,
    resumo: dict.resumo.entradaRestante(50, fmt(total * 0.5), fmt(total * 0.5)),
  };
  const tenant = {
    nome_empresa: "Estúdio Aurora",
    nome_profissional: "João Pedro Martins",
    email: "contato@estudioaurora.com",
    telefone: "(11) 3333-4444",
    idioma,
  } as unknown as Tenant;
  return {
    form,
    total,
    plano,
    tenant,
    cor: "#000000",
    corSuave: "#f5f5f5",
    numero: "0042",
    dataHoje: idioma === "es" ? "26/07/2026" : "26/07/2026",
    dict,
    fmt,
    linkPagamento: "https://exemplo.com/pagar/abc123",
    qrPagamento: null,
  };
}

const META: Record<TemplatePremium, { nome: string; nota: string }> = {
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

const ORDEM: TemplatePremium[] = ["atelier_noir", "blueprint_tecnico", "swiss_studio"];

function PainelTemplate({
  id,
  idioma,
}: {
  id: TemplatePremium;
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
        {id === "atelier_noir" ? (
          <TemplateAtelierNoir
            {...exemploOrcamento(idioma)}
            tema={tema}
            fontes={FONTES}
          />
        ) : id === "blueprint_tecnico" ? (
          <TemplateBlueprintTecnico
            {...exemploOrcamento(idioma)}
            tema={tema}
            fontes={FONTES}
          />
        ) : (
          <TemplateSwissStudio
            {...exemploOrcamento(idioma)}
            tema={tema}
            fontes={FONTES}
          />
        )}
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
