"use client";

/**
 * Rota de PREVIEW da UI de toggles "mostrar/esconder blocos" (Etapa 4, Plano
 * Pro). Trabalho interno de verificação — NÃO é o fluxo real de criação de
 * orçamento (isso entra na Etapa 5). Sem auth, sem DB: dados fictícios "Estúdio
 * Aurora", os mesmos do /preview-templates.
 *
 * O que esta tela prova:
 *   - uma lista simples de checkboxes, um por bloco do template escolhido, com
 *     nome LEGÍVEL (rotuloBloco), nunca o blocoId técnico;
 *   - marcar/desmarcar alimenta `blocos_ocultos` (o mesmo campo validado desde a
 *     Etapa 1), passado ao template como `ocultos`;
 *   - o documento à direita re-renderiza ao vivo via resolverBlocos, provando
 *     que esconder um bloco não quebra a ordem canônica nem o layout;
 *   - os blocos que nascem ocultos por padrão (banco_horas/projetos/condicoes
 *     nos premium) aparecem DESABILITADOS com a nota "sem dados", porque não têm
 *     fonte de dado no formulário e resolverBlocos sempre os esconde.
 *
 * Sem persistência: recarregar volta ao padrão — exatamente o comportamento
 * combinado (enquanto não se salva, o toggle é efêmero).
 */
import { useMemo, useState } from "react";
import {
  BLOCOS_PADRAO_OCULTOS,
  blocosDoTemplate,
  normalizarOcultos,
} from "@/lib/blocos-core";
import { rotuloBloco } from "@/lib/blocos-rotulos";
import { derivarTema, type TemplateId } from "@/lib/templates-core";
import { FONTES } from "@/lib/fontes-templates";
import {
  TemplateAtelierNoir,
  TemplateBlueprintTecnico,
  TemplateSwissStudio,
} from "@/components/templates-premium";
import {
  TemplateClassico,
  TemplateModerno,
  TemplateSimples,
  type TemplateProps,
} from "@/components/orcamento-templates";
import { getDict } from "@/lib/i18n";
import type { FormState, PlanoPagamento } from "@/components/orcamentos-manager";
import type { Tenant } from "@/lib/types";

type Idioma = "pt" | "es";

const PREMIUM = new Set<TemplateId>([
  "atelier_noir",
  "blueprint_tecnico",
  "swiss_studio",
]);

/** Ordem e nome amigável dos 6 templates no seletor. */
const TEMPLATES: { id: TemplateId; nome: string }[] = [
  { id: "classico", nome: "Clássico" },
  { id: "moderno", nome: "Moderno" },
  { id: "simples", nome: "Simples" },
  { id: "atelier_noir", nome: "Atelier Noir" },
  { id: "blueprint_tecnico", nome: "Blueprint Técnico" },
  { id: "swiss_studio", nome: "Swiss Studio" },
];

/** Sufixo "sem dados" ao lado dos blocos padrão-ocultos, por idioma. */
const SEM_DADOS: Record<Idioma, string> = {
  pt: "sem dados neste formulário",
  es: "sin datos en este formulario",
};

/**
 * Orçamento de exemplo — mesmo conteúdo fictício do /preview-templates, para que
 * a verificação visual seja comparável entre as duas rotas. `idioma` só troca
 * moeda/rótulos do exemplo.
 */
function exemploOrcamento(idioma: Idioma): TemplateProps {
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
    cor: "#111111",
    corSuave: "#f5f5f5",
    numero: "0042",
    dataHoje: "26/07/2026",
    dict,
    fmt,
    // Link fictício para o bloco pagar_online aparecer na demonstração.
    linkPagamento: "https://exemplo.com/pagar/abc123",
    qrPagamento: null,
  };
}

/** Renderiza o template certo com os blocos ocultos aplicados. */
function DocumentoRenderizado({
  templateId,
  idioma,
  ocultos,
}: {
  templateId: TemplateId;
  idioma: Idioma;
  ocultos: string[];
}) {
  const props = exemploOrcamento(idioma);

  if (PREMIUM.has(templateId)) {
    // Sem edição de cor aqui: o tema padrão do template já basta para a
    // verificação dos toggles (derivarTema com null usa PALETAS_PADRAO).
    const tema = derivarTema(templateId, null);
    if (!tema) return null;
    const comuns = { ...props, ocultos, tema, fontes: FONTES };
    if (templateId === "atelier_noir")
      return <TemplateAtelierNoir {...comuns} />;
    if (templateId === "blueprint_tecnico")
      return <TemplateBlueprintTecnico {...comuns} />;
    return <TemplateSwissStudio {...comuns} />;
  }

  const comuns = { ...props, ocultos };
  if (templateId === "classico") return <TemplateClassico {...comuns} />;
  if (templateId === "moderno") return <TemplateModerno {...comuns} />;
  return <TemplateSimples {...comuns} />;
}

export default function PreviewTogglesPage() {
  const [templateId, setTemplateId] = useState<TemplateId>("atelier_noir");
  const [idioma, setIdioma] = useState<Idioma>("pt");
  // Blocos que o usuário escolheu esconder (só os que TÊM dado; os padrão-
  // ocultos nunca entram aqui — ficam desabilitados na UI).
  const [ocultosUsuario, setOcultosUsuario] = useState<Set<string>>(new Set());

  const catalogo = blocosDoTemplate(templateId);
  const padraoOcultos = useMemo(
    () => new Set(BLOCOS_PADRAO_OCULTOS[templateId] ?? []),
    [templateId],
  );

  // O que alimenta `blocos_ocultos`: escolha do tenant, normalizada (a forma
  // canônica de persistir na Etapa 5). Padrão-ocultos NÃO entram — são default
  // de projeto, não escolha do usuário.
  const blocosOcultos = useMemo(
    () => normalizarOcultos(templateId, Array.from(ocultosUsuario)),
    [templateId, ocultosUsuario],
  );

  function trocarTemplate(id: TemplateId) {
    setTemplateId(id);
    // Ids de bloco mudam entre templates — zera a escolha do usuário.
    setOcultosUsuario(new Set());
  }

  function toggleBloco(id: string) {
    setOcultosUsuario((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b0b0c",
        color: "#e8e8e8",
        padding: "40px 24px 80px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1180px", margin: "0 auto 28px" }}>
        <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#fff" }}>
          Toggles de blocos — Plano Pro
        </h1>
        <p style={{ fontSize: "14px", color: "#8a8a8a", marginTop: "6px" }}>
          Marque/desmarque para mostrar ou esconder blocos do orçamento. Conteúdo
          fictício (Estúdio Aurora); nada é salvo — recarregar volta ao padrão.
        </p>
      </div>

      <div
        style={{
          maxWidth: "1180px",
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: "28px",
        }}
      >
        {/* ---- Painel de controles ---- */}
        <aside
          style={{
            flex: "0 0 320px",
            maxWidth: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "22px",
          }}
        >
          <div>
            <div style={rotuloSecao}>Template</div>
            <select
              value={templateId}
              onChange={(e) => trocarTemplate(e.target.value as TemplateId)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid #2a2a2c",
                background: "#161618",
                color: "#f0f0f0",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>

            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
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
                    border: "1px solid #2a2a2c",
                    background: idioma === lng ? "#fff" : "transparent",
                    color: idioma === lng ? "#000" : "#bbb",
                  }}
                >
                  {lng}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={rotuloSecao}>Blocos do documento</div>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              {catalogo.map((id) => {
                const desabilitado = padraoOcultos.has(id);
                const marcado = !desabilitado && !ocultosUsuario.has(id);
                return (
                  <li key={id}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        cursor: desabilitado ? "not-allowed" : "pointer",
                        opacity: desabilitado ? 0.45 : 1,
                        background: marcado ? "rgba(255,255,255,0.04)" : "transparent",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={marcado}
                        disabled={desabilitado}
                        onChange={() => toggleBloco(id)}
                        style={{
                          width: "16px",
                          height: "16px",
                          accentColor: "#6ee7b7",
                          cursor: desabilitado ? "not-allowed" : "pointer",
                        }}
                      />
                      <span style={{ fontSize: "14px", color: "#e8e8e8" }}>
                        {rotuloBloco(id, idioma)}
                      </span>
                      {desabilitado && (
                        <span
                          style={{
                            marginLeft: "auto",
                            fontSize: "11px",
                            color: "#8a8a8a",
                            fontStyle: "italic",
                          }}
                        >
                          {SEM_DADOS[idioma]}
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <div style={rotuloSecao}>
              blocos_ocultos <span style={{ color: "#6a6a6a" }}>(o que seria salvo)</span>
            </div>
            <pre
              style={{
                margin: 0,
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #2a2a2c",
                background: "#161618",
                color: "#9be7c4",
                fontSize: "12px",
                fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {JSON.stringify(blocosOcultos)}
            </pre>
            <p style={{ fontSize: "11px", color: "#6a6a6a", marginTop: "8px", lineHeight: 1.5 }}>
              Os blocos <em>sem dados</em> não entram aqui — são ocultos por padrão
              do projeto, não escolha do usuário. resolverBlocos os esconde de
              qualquer forma.
            </p>
          </div>
        </aside>

        {/* ---- Documento renderizado (folha A4) ---- */}
        <div style={{ flex: "1 1 640px", minWidth: 0 }}>
          <div
            style={{
              width: "210mm",
              maxWidth: "100%",
              margin: "0 auto",
              boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
              overflow: "hidden",
              background: "#fff",
            }}
          >
            <DocumentoRenderizado
              templateId={templateId}
              idioma={idioma}
              ocultos={blocosOcultos}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

const rotuloSecao: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "1.5px",
  textTransform: "uppercase",
  color: "#8a8a8a",
  marginBottom: "10px",
};
