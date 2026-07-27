/**
 * Os três templates premium do segmento web designer, exclusivos do Plano Max.
 *
 *   Atelier Noir       — editorial de luxo, escuro, dourado + vinho, serifada.
 *   Blueprint Técnico   — spec sheet, navy, ciano + âmbar, mono + grotesk.
 *   Swiss Studio        — cartaz suíço, claro, um único vermelho, Archivo pesada.
 *
 * Estilizados INLINE de propósito: a prévia é rasterizada por html2canvas para
 * virar o PDF, e o markup da tela É o markup do PDF. Nenhuma cor é literal —
 * todas vêm de `tema` (derivado em lib/templates-core.js a partir dos poucos
 * tokens editáveis), então trocar a paleta no seletor recalcula superfícies,
 * bordas e contrastes sem quebrar o documento. As fontes chegam por `fontes`
 * (lib/fontes-templates.ts), servidas do próprio domínio para o html2canvas
 * capturá-las.
 *
 * O conteúdo é 100% fictício (Studio Exemplo) — ver templates-premium-conteudo.
 */
import { Fragment } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { TemaTemplate } from "@/lib/templates-core";
import type { FONTES } from "@/lib/fontes-templates";
import { resolverBlocos } from "@/lib/blocos-core";
import type { TemplateProps } from "./orcamento-templates";
import { conteudoDemo, type ItemServico } from "./templates-premium-conteudo";

type Fontes = typeof FONTES;

/**
 * Props dos templates premium já convertidos em orçamento real (recebem os
 * MESMOS dados dos 3 básicos, mais o `tema` derivado e as `fontes`). A partir da
 * Etapa 3, é o contrato do Atelier Noir; Blueprint e Swiss migram nas 3b/3c.
 */
export type TemplatePremiumProps = TemplateProps & {
  tema: TemaTemplate;
  fontes: Fontes;
};

/**
 * Props do modo DEMO (conteúdo fictício "Studio Exemplo"), ainda usado por
 * Blueprint e Swiss até serem convertidos. Some quando 3b/3c terminarem.
 */
export type TemplatePremiumDemoProps = {
  tema: TemaTemplate;
  fontes: Fontes;
  idioma?: string;
};

/** Rótulos do box "Pagar online" (inline pt/es) — espelha os 3 básicos. */
const PAGAR_LABELS = {
  pt: {
    titulo: "Pague online",
    clique: "Clique aqui para pagar",
    qr: "Ou aponte a câmera para o QR Code",
  },
  es: {
    titulo: "Pagá online",
    clique: "Hacé clic aquí para pagar",
    qr: "O escaneá el QR con tu cámara",
  },
} as const;

/* ===========================================================================
 * A) ATELIER NOIR — editorial de luxo (orçamento real, 3a)
 * --------------------------------------------------------------------------
 * Recebe os MESMOS dados dos 3 básicos (form/total/plano/tenant/…), mais o
 * `tema` derivado e as `fontes`. Renderiza por blocoId via resolverBlocos, na
 * pele editorial do Atelier. banco_horas/projetos/condicoes ficam ocultos por
 * padrão (BLOCOS_PADRAO_OCULTOS) — sem fonte de dado no formulário.
 * ======================================================================== */
export function TemplateAtelierNoir({
  form,
  total,
  plano,
  tenant,
  numero,
  dataHoje,
  dict,
  fmt,
  linkPagamento,
  qrPagamento,
  ocultos,
  tema,
  fontes,
}: TemplatePremiumProps) {
  const idioma = (tenant?.idioma as "pt" | "es") ?? "pt";
  const serif = fontes.playfair;
  const sans = fontes.dmSans;

  const kicker = (t: string) => (
    <div
      style={{
        fontFamily: sans,
        fontSize: "10px",
        letterSpacing: "3px",
        textTransform: "uppercase",
        color: tema.acentoTexto,
        fontWeight: 600,
      }}
    >
      {t}
    </div>
  );

  // Nome do estúdio em serifada; a última palavra ganha itálico dourado quando
  // há 2+ palavras (fallback elegante para nomes de uma só palavra).
  const nomeEstudio = (n: string): ReactNode => {
    const partes = n.trim().split(/\s+/);
    if (partes.length < 2) return n;
    const ultima = partes[partes.length - 1];
    const resto = partes.slice(0, -1).join(" ");
    return (
      <>
        {resto}
        <br />
        <span style={{ fontStyle: "italic", color: tema.acentoTexto }}>
          {ultima}
        </span>
      </>
    );
  };

  const blocos: Record<string, () => ReactNode> = {
    cabecalho: () => (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "24px",
          marginBottom: "40px",
        }}
      >
        <div>
          {tenant?.nome_profissional ? kicker(tenant.nome_profissional) : null}
          <div
            style={{
              fontFamily: serif,
              fontSize: "58px",
              fontWeight: 700,
              lineHeight: 0.95,
              letterSpacing: "-1px",
              marginTop: "12px",
              color: tema.texto,
            }}
          >
            {nomeEstudio(tenant?.nome_empresa || "Sua Empresa")}
          </div>
        </div>
        <div
          style={{ textAlign: "right", whiteSpace: "nowrap", paddingTop: "6px" }}
        >
          {(
            [
              [dict.pdf.numero, numero],
              [dict.pdf.data, dataHoje],
              [dict.pdf.validade, dict.pdf.validadeVal],
            ] as const
          ).map(([rotulo, valor]) => (
            <div key={rotulo} style={{ marginBottom: "8px" }}>
              <div
                style={{
                  fontFamily: sans,
                  fontSize: "9px",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  color: tema.acentoTexto,
                  fontWeight: 600,
                }}
              >
                {rotulo}
              </div>
              <div
                style={{
                  fontFamily: sans,
                  fontSize: "13px",
                  color: tema.texto,
                  marginTop: "2px",
                }}
              >
                {valor}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),

    cliente: () => (
      <div
        style={{
          borderLeft: `2px solid ${tema.secundario}`,
          paddingLeft: "16px",
          marginBottom: "36px",
        }}
      >
        {kicker(dict.pdf.cliente)}
        <div
          style={{
            fontFamily: serif,
            fontSize: "24px",
            color: tema.texto,
            marginTop: "8px",
          }}
        >
          {form.cliente_nome || dict.pdf.nomeCliente}
        </div>
        {form.cliente_email || form.cliente_telefone ? (
          <div
            style={{
              fontFamily: sans,
              fontSize: "12px",
              color: tema.textoSuave,
              marginTop: "6px",
            }}
          >
            {[form.cliente_email, form.cliente_telefone]
              .filter(Boolean)
              .join("  ·  ")}
          </div>
        ) : null}
      </div>
    ),

    servicos: () => (
      <>
        <div style={{ marginBottom: "16px" }}>{kicker(dict.pdf.servicos)}</div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            marginBottom: "32px",
          }}
        >
          {form.servicos
            .filter((s) => s.descricao || s.valor)
            .map((s, i) => (
              <div
                key={s.id}
                style={{
                  background: tema.superficie,
                  borderTop: `2px solid ${tema.secundario}`,
                  borderRadius: tema.raio,
                  padding: "20px 24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    fontFamily: serif,
                    fontSize: "21px",
                    fontWeight: 700,
                    color: tema.texto,
                    lineHeight: 1.15,
                  }}
                >
                  {s.descricao || dict.orc.servicoN(i + 1)}
                </div>
                <div
                  style={{
                    fontFamily: serif,
                    fontSize: "30px",
                    fontWeight: 700,
                    color: tema.acentoTextoGrande,
                    whiteSpace: "nowrap",
                  }}
                >
                  {fmt(parseFloat(s.valor) || 0)}
                </div>
              </div>
            ))}
        </div>
      </>
    ),

    total: () => (
      <div
        style={{
          borderTop: `2px solid ${tema.secundario}`,
          paddingTop: "18px",
          marginBottom: "36px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <div
          style={{
            fontFamily: sans,
            fontSize: "11px",
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: tema.acentoTexto,
            fontWeight: 600,
          }}
        >
          {dict.pdf.total}
        </div>
        <div
          style={{
            fontFamily: serif,
            fontSize: "42px",
            fontWeight: 700,
            color: tema.acentoTextoGrande,
            lineHeight: 1,
          }}
        >
          {fmt(total)}
        </div>
      </div>
    ),

    pagamento: () => (
      <div style={{ marginBottom: "36px" }}>
        <div style={{ marginBottom: "14px" }}>{kicker(dict.pdf.pagamento)}</div>

        {plano.tipo === "unico" && (
          <div style={{ fontFamily: serif, fontSize: "20px", color: tema.texto }}>
            {dict.pdf.pagamentoAVista} —{" "}
            <span style={{ color: tema.acentoTextoGrande }}>{fmt(total)}</span>
          </div>
        )}

        {plano.tipo === "entrada_restante" && (
          <>
            <div style={{ display: "flex", gap: "16px" }}>
              <div
                style={{
                  flex: 1,
                  background: tema.superficie,
                  borderRadius: tema.raio,
                  padding: "18px 20px",
                }}
              >
                <div
                  style={{
                    fontFamily: sans,
                    fontSize: "11px",
                    color: tema.textoSuave,
                    marginBottom: "6px",
                  }}
                >
                  {dict.pdf.entradaPct(plano.pct)}
                </div>
                <div
                  style={{
                    fontFamily: serif,
                    fontSize: "24px",
                    fontWeight: 700,
                    color: tema.acentoTextoGrande,
                  }}
                >
                  {fmt(plano.entrada)}
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  background: tema.superficie,
                  borderRadius: tema.raio,
                  padding: "18px 20px",
                }}
              >
                <div
                  style={{
                    fontFamily: sans,
                    fontSize: "11px",
                    color: tema.textoSuave,
                    marginBottom: "6px",
                  }}
                >
                  {dict.pdf.restantePct(Number((100 - plano.pct).toFixed(0)))}
                </div>
                <div
                  style={{
                    fontFamily: serif,
                    fontSize: "24px",
                    fontWeight: 700,
                    color: tema.acentoTextoGrande,
                  }}
                >
                  {fmt(plano.restante)}
                </div>
              </div>
            </div>
            <div
              style={{
                fontFamily: sans,
                fontSize: "11px",
                color: tema.textoSuave,
                marginTop: "10px",
              }}
            >
              {dict.pdf.doisPagamentosNota}
            </div>
          </>
        )}

        {plano.tipo === "parcelado" && (
          <>
            <div
              style={{
                fontFamily: sans,
                fontSize: "12px",
                color: tema.textoSuave,
                marginBottom: "10px",
              }}
            >
              {plano.subtipo === "entrada_diferenciada"
                ? dict.pdf.parceladoEntradaDif(plano.n)
                : dict.pdf.parceladoIguais(plano.n)}
            </div>
            <div>
              {plano.parcelas.map((p, i) => (
                <div
                  key={p.numero}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    padding: "11px 0",
                    borderTop: i === 0 ? "none" : `1px solid ${tema.hairline}`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: sans,
                      fontSize: "13px",
                      color: tema.textoSuave,
                    }}
                  >
                    {p.entrada
                      ? dict.pdf.entradaPrimeira
                      : dict.pdf.parcelaN(p.numero)}
                  </div>
                  <div
                    style={{
                      fontFamily: serif,
                      fontSize: "18px",
                      fontWeight: 700,
                      color: tema.acentoTextoGrande,
                    }}
                  >
                    {fmt(p.valor)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    ),

    pagar_online: () => {
      if (!linkPagamento) return null;
      const t = PAGAR_LABELS[idioma] ?? PAGAR_LABELS.pt;
      return (
        <div
          style={{
            background: tema.superficie,
            borderRadius: tema.raio,
            padding: "22px 24px",
            marginBottom: "36px",
            display: "flex",
            alignItems: "center",
            gap: "24px",
          }}
        >
          <div style={{ flex: 1 }}>
            {kicker(t.titulo)}
            <div
              style={{
                fontFamily: sans,
                fontSize: "13px",
                color: tema.texto,
                marginTop: "10px",
              }}
            >
              {t.clique}
            </div>
            <div
              style={{
                fontFamily: sans,
                fontSize: "12px",
                color: tema.acentoTexto,
                marginTop: "6px",
                wordBreak: "break-all",
              }}
            >
              {linkPagamento}
            </div>
            {qrPagamento ? (
              <div
                style={{
                  fontFamily: sans,
                  fontSize: "11px",
                  color: tema.textoSuave,
                  marginTop: "8px",
                }}
              >
                {t.qr}
              </div>
            ) : null}
          </div>
          {qrPagamento ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrPagamento}
              alt="QR Code"
              style={{
                width: "112px",
                height: "112px",
                borderRadius: tema.raio,
                background: "#ffffff",
                padding: "8px",
                border: `1px solid ${tema.hairline}`,
              }}
            />
          ) : null}
        </div>
      );
    },

    nota: () =>
      form.nota ? (
        <div
          style={{
            borderLeft: `2px solid ${tema.secundario}`,
            paddingLeft: "16px",
            marginBottom: "36px",
            fontFamily: sans,
            fontSize: "12px",
            color: tema.textoSuave,
            lineHeight: 1.6,
          }}
        >
          {form.nota}
        </div>
      ) : null,

    rodape: () => (
      <div
        style={{
          borderTop: `1px solid ${tema.hairline}`,
          paddingTop: "16px",
          textAlign: "center",
          fontFamily: sans,
          fontSize: "10px",
          letterSpacing: "0.5px",
          color: tema.textoSuave,
        }}
      >
        {[tenant?.nome_empresa, tenant?.email, tenant?.telefone]
          .filter(Boolean)
          .join("  ·  ")}
      </div>
    ),
  };

  return (
    <div
      style={{
        background: tema.fundo,
        color: tema.texto,
        padding: "48px 44px",
        fontFamily: sans,
      }}
    >
      {resolverBlocos("atelier_noir", ocultos).map((id) => (
        <Fragment key={id}>{blocos[id]?.()}</Fragment>
      ))}
    </div>
  );
}

/* ===========================================================================
 * B) BLUEPRINT TÉCNICO — spec sheet (orçamento real, 3b)
 * --------------------------------------------------------------------------
 * Recebe os MESMOS dados dos 3 básicos (form/total/plano/tenant/…), mais o
 * `tema` derivado e as `fontes`. Renderiza por blocoId via resolverBlocos, na
 * pele de spec técnica do Blueprint (navy + malha pontilhada, Space Grotesk +
 * JetBrains Mono, ciano nos rótulos e âmbar como cor do dinheiro, cantos retos,
 * marcas "+" de coordenada). banco_horas/projetos/condicoes ficam ocultos por
 * padrão (BLOCOS_PADRAO_OCULTOS) — sem fonte de dado no formulário.
 * ======================================================================== */
export function TemplateBlueprintTecnico({
  form,
  total,
  plano,
  tenant,
  numero,
  dataHoje,
  dict,
  fmt,
  linkPagamento,
  qrPagamento,
  ocultos,
  tema,
  fontes,
}: TemplatePremiumProps) {
  const idioma = (tenant?.idioma as "pt" | "es") ?? "pt";
  const grotesk = fontes.spaceGrotesk;
  const mono = fontes.jetbrainsMono;
  const grade = tema.grade ?? tema.hairline;

  // Malha pontilhada do fundo: dois radial-gradients baem-computados pelo
  // html2canvas (não são color-mix nem var). Marcas "+" ficam nos cantos.
  const fundoGrade = `radial-gradient(${grade} 1px, transparent 1px)`;

  const Marca = ({ ...pos }: CSSProperties) => (
    <span
      style={{
        position: "absolute",
        color: tema.acentoTexto,
        fontFamily: mono,
        fontSize: "14px",
        lineHeight: 1,
        ...pos,
      }}
    >
      +
    </span>
  );

  const label = (t: string) => (
    <span
      style={{
        fontFamily: mono,
        fontSize: "10px",
        letterSpacing: "1.5px",
        textTransform: "uppercase",
        color: tema.acentoTexto,
      }}
    >
      {t}
    </span>
  );

  const tPagar = PAGAR_LABELS[idioma] ?? PAGAR_LABELS.pt;

  // Numeração dinâmica das seções: só recebem número os blocos que realmente
  // vão renderar conteúdo (pagar_online/nota podem estar ausentes), para não
  // abrir buracos como "01, 02, 04". O rótulo "NN / TÍTULO" é a assinatura do
  // Blueprint; a numeração acompanha a ordem canônica visível.
  const renderavel: Record<string, boolean> = {
    cliente: true,
    servicos: true,
    pagamento: true,
    pagar_online: !!linkPagamento,
    nota: !!form.nota,
  };
  const numeroSecao = new Map(
    resolverBlocos("blueprint_tecnico", ocultos)
      .filter((id) => renderavel[id])
      .map((id, i) => [id, String(i + 1).padStart(2, "0")]),
  );
  const secLabel = (id: string, texto: string) =>
    label(`${numeroSecao.get(id) ?? "00"} / ${texto}`);

  const marcas = (
    <>
      <Marca top="-7px" left="-7px" />
      <Marca top="-7px" right="-7px" />
      <Marca bottom="-7px" left="-7px" />
      <Marca bottom="-7px" right="-7px" />
    </>
  );

  const blocos: Record<string, () => ReactNode> = {
    cabecalho: () => (
      <div
        style={{
          position: "relative",
          border: `1px solid ${tema.hairline}`,
          padding: "28px 26px",
          marginBottom: "34px",
          background: tema.superficie,
        }}
      >
        {marcas}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "24px",
          }}
        >
          <div>
            {tenant?.nome_profissional
              ? label("// " + tenant.nome_profissional)
              : null}
            <div
              style={{
                fontFamily: grotesk,
                fontSize: "40px",
                fontWeight: 700,
                letterSpacing: "-1px",
                color: tema.texto,
                marginTop: "8px",
                lineHeight: 1,
              }}
            >
              {tenant?.nome_empresa || "Sua Empresa"}
              <span style={{ color: tema.acentoTexto }}>.</span>
            </div>
          </div>
          <div
            style={{
              textAlign: "right",
              whiteSpace: "nowrap",
              paddingTop: "4px",
            }}
          >
            {(
              [
                [dict.pdf.numero, numero],
                [dict.pdf.data, dataHoje],
                [dict.pdf.validade, dict.pdf.validadeVal],
              ] as const
            ).map(([rotulo, valor]) => (
              <div key={rotulo} style={{ marginBottom: "8px" }}>
                <div
                  style={{
                    fontFamily: mono,
                    fontSize: "9px",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    color: tema.acentoTexto,
                  }}
                >
                  {rotulo}
                </div>
                <div
                  style={{
                    fontFamily: mono,
                    fontSize: "13px",
                    color: tema.texto,
                    marginTop: "2px",
                  }}
                >
                  {valor}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),

    cliente: () => (
      <div style={{ marginBottom: "32px" }}>
        <div style={{ marginBottom: "12px" }}>
          {secLabel("cliente", dict.pdf.cliente)}
        </div>
        <div
          style={{
            background: tema.superficie,
            border: `1px solid ${tema.hairline}`,
            borderLeft: `3px solid ${tema.secundario}`,
            padding: "16px 18px",
          }}
        >
          <div
            style={{
              fontFamily: grotesk,
              fontSize: "20px",
              fontWeight: 700,
              color: tema.texto,
            }}
          >
            {form.cliente_nome || dict.pdf.nomeCliente}
          </div>
          {form.cliente_email || form.cliente_telefone ? (
            <div
              style={{
                fontFamily: mono,
                fontSize: "10.5px",
                color: tema.textoSuave,
                marginTop: "6px",
              }}
            >
              {[form.cliente_email, form.cliente_telefone]
                .filter(Boolean)
                .join("  ·  ")}
            </div>
          ) : null}
        </div>
      </div>
    ),

    servicos: () => (
      <div style={{ marginBottom: "32px" }}>
        <div style={{ marginBottom: "12px" }}>
          {secLabel("servicos", dict.pdf.servicos)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {form.servicos
            .filter((s) => s.descricao || s.valor)
            .map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr 130px",
                  alignItems: "center",
                  gap: "16px",
                  padding: "16px 18px",
                  background: tema.superficie,
                  border: `1px solid ${tema.hairline}`,
                  borderLeft: `3px solid ${tema.secundario}`,
                }}
              >
                <div
                  style={{
                    fontFamily: mono,
                    fontSize: "13px",
                    color: tema.textoSuave,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div
                  style={{
                    fontFamily: grotesk,
                    fontSize: "16px",
                    fontWeight: 700,
                    color: tema.texto,
                    lineHeight: 1.2,
                  }}
                >
                  {s.descricao || dict.orc.servicoN(i + 1)}
                </div>
                <div
                  style={{
                    textAlign: "right",
                    fontFamily: mono,
                    fontSize: "22px",
                    fontWeight: 700,
                    color: tema.texto,
                    whiteSpace: "nowrap",
                  }}
                >
                  {fmt(parseFloat(s.valor) || 0)}
                </div>
              </div>
            ))}
        </div>
      </div>
    ),

    total: () => (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          borderTop: `1px solid ${tema.divisor}`,
          paddingTop: "18px",
          marginBottom: "32px",
        }}
      >
        <div
          style={{
            fontFamily: mono,
            fontSize: "11px",
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: tema.acentoTexto,
          }}
        >
          {dict.pdf.total}
        </div>
        <div
          style={{
            fontFamily: mono,
            fontSize: "40px",
            fontWeight: 700,
            color: tema.secundarioTexto,
            lineHeight: 1,
          }}
        >
          {fmt(total)}
        </div>
      </div>
    ),

    pagamento: () => (
      <div style={{ marginBottom: "32px" }}>
        <div style={{ marginBottom: "12px" }}>
          {secLabel("pagamento", dict.pdf.pagamento)}
        </div>

        {plano.tipo === "unico" && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              fontFamily: mono,
              padding: "6px 0",
            }}
          >
            <span style={{ fontSize: "14px", color: tema.texto }}>
              {dict.pdf.pagamentoAVista}
            </span>
            <span
              style={{
                fontSize: "28px",
                fontWeight: 700,
                color: tema.secundarioTexto,
              }}
            >
              {fmt(total)}
            </span>
          </div>
        )}

        {plano.tipo === "entrada_restante" && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
              }}
            >
              {(
                [
                  [dict.pdf.entradaPct(plano.pct), plano.entrada],
                  [
                    dict.pdf.restantePct(Number((100 - plano.pct).toFixed(0))),
                    plano.restante,
                  ],
                ] as const
              ).map(([rotulo, valor]) => (
                <div
                  key={rotulo}
                  style={{
                    background: tema.superficie,
                    border: `1px solid ${tema.hairline}`,
                    borderTop: `2px solid ${tema.secundario}`,
                    padding: "18px 16px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: mono,
                      fontSize: "10px",
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      color: tema.textoSuave,
                    }}
                  >
                    {rotulo}
                  </div>
                  <div
                    style={{
                      fontFamily: mono,
                      fontSize: "26px",
                      fontWeight: 700,
                      color: tema.secundarioTexto,
                      marginTop: "8px",
                    }}
                  >
                    {fmt(valor)}
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                fontFamily: mono,
                fontSize: "11px",
                color: tema.textoSuave,
                marginTop: "10px",
              }}
            >
              {dict.pdf.doisPagamentosNota}
            </div>
          </>
        )}

        {plano.tipo === "parcelado" && (
          <>
            <div
              style={{
                fontFamily: mono,
                fontSize: "12px",
                color: tema.textoSuave,
                marginBottom: "10px",
              }}
            >
              {plano.subtipo === "entrada_diferenciada"
                ? dict.pdf.parceladoEntradaDif(plano.n)
                : dict.pdf.parceladoIguais(plano.n)}
            </div>
            <div>
              {plano.parcelas.map((p, i) => (
                <div
                  key={p.numero}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    padding: "11px 0",
                    borderTop: i === 0 ? "none" : `1px solid ${tema.hairline}`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: mono,
                      fontSize: "13px",
                      color: tema.textoSuave,
                    }}
                  >
                    {p.entrada
                      ? dict.pdf.entradaPrimeira
                      : dict.pdf.parcelaN(p.numero)}
                  </div>
                  <div
                    style={{
                      fontFamily: mono,
                      fontSize: "18px",
                      fontWeight: 700,
                      color: tema.secundarioTexto,
                    }}
                  >
                    {fmt(p.valor)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    ),

    pagar_online: () => {
      if (!linkPagamento) return null;
      return (
        <div style={{ marginBottom: "32px" }}>
          <div style={{ marginBottom: "12px" }}>
            {secLabel("pagar_online", tPagar.titulo)}
          </div>
          <div
            style={{
              position: "relative",
              border: `1px solid ${tema.hairline}`,
              background: tema.superficie,
              padding: "22px 24px",
              display: "flex",
              alignItems: "center",
              gap: "24px",
            }}
          >
            {marcas}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: mono,
                  fontSize: "12px",
                  color: tema.texto,
                  lineHeight: 1.5,
                }}
              >
                {tPagar.clique}
              </div>
              <div
                style={{
                  fontFamily: mono,
                  fontSize: "12px",
                  color: tema.acentoTexto,
                  marginTop: "6px",
                  wordBreak: "break-all",
                }}
              >
                {linkPagamento}
              </div>
              {qrPagamento ? (
                <div
                  style={{
                    fontFamily: mono,
                    fontSize: "11px",
                    color: tema.textoSuave,
                    marginTop: "8px",
                  }}
                >
                  {tPagar.qr}
                </div>
              ) : null}
            </div>
            {qrPagamento ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrPagamento}
                alt="QR Code"
                style={{
                  width: "112px",
                  height: "112px",
                  background: "#ffffff",
                  padding: "8px",
                  border: `1px solid ${tema.hairline}`,
                }}
              />
            ) : null}
          </div>
        </div>
      );
    },

    nota: () =>
      form.nota ? (
        <div style={{ marginBottom: "32px" }}>
          <div style={{ marginBottom: "12px" }}>
            {secLabel(
              "nota",
              idioma === "es" ? "Observaciones" : "Observações",
            )}
          </div>
          <div
            style={{
              borderLeft: `3px solid ${tema.secundario}`,
              paddingLeft: "16px",
              fontFamily: mono,
              fontSize: "11px",
              color: tema.textoSuave,
              lineHeight: 1.6,
            }}
          >
            {form.nota}
          </div>
        </div>
      ) : null,

    rodape: () => (
      <div
        style={{
          fontFamily: mono,
          fontSize: "10px",
          letterSpacing: "0.5px",
          color: tema.textoSuave,
          textAlign: "center",
          marginTop: "30px",
          paddingTop: "16px",
          borderTop: `1px solid ${tema.hairline}`,
        }}
      >
        {[tenant?.nome_empresa, tenant?.email, tenant?.telefone]
          .filter(Boolean)
          .join("  ·  ")}
      </div>
    ),
  };

  return (
    <div
      style={{
        background: tema.fundo,
        backgroundImage: fundoGrade,
        backgroundSize: "22px 22px",
        color: tema.texto,
        padding: "44px 40px",
        fontFamily: grotesk,
      }}
    >
      {resolverBlocos("blueprint_tecnico", ocultos).map((id) => (
        <Fragment key={id}>{blocos[id]?.()}</Fragment>
      ))}
    </div>
  );
}

/* ===========================================================================
 * C) SWISS STUDIO — cartaz tipográfico suíço
 * ======================================================================== */
export function TemplateSwissStudio({
  tema,
  fontes,
  idioma,
}: TemplatePremiumDemoProps) {
  const c = conteudoDemo(idioma);
  const archivo = fontes.archivo;
  const narrow = fontes.archivoNarrow;

  // Coluna fixa de numeração de seção: número grande em outline à esquerda.
  const secao = (num: string, titulo: string, children: ReactNode) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "96px 1fr",
        gap: "18px",
        borderTop: `2px solid ${tema.hairline}`,
        paddingTop: "18px",
        marginBottom: "34px",
      }}
    >
      <div>
        <div
          style={{
            fontFamily: archivo,
            fontSize: "68px",
            fontWeight: 900,
            lineHeight: 0.8,
            color: "transparent",
            WebkitTextStroke: `1.5px ${tema.outline ?? tema.divisor}`,
          }}
        >
          {num}
        </div>
        <div
          style={{
            fontFamily: narrow,
            fontSize: "12px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "1px",
            color: tema.texto,
            marginTop: "10px",
            writingMode: "horizontal-tb",
          }}
        >
          {titulo}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );

  const PrecoServico = (s: ItemServico, ultimo = false) => (
    <div
      key={s.ordem}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        padding: "16px 0",
        borderBottom: ultimo ? "none" : `2px solid ${tema.divisor}`,
      }}
    >
      <div style={{ maxWidth: "62%" }}>
        <div
          style={{
            fontFamily: archivo,
            fontSize: "20px",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "-0.5px",
            color: tema.texto,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          {s.nome}
          {s.tag ? (
            <span
              style={{
                fontFamily: narrow,
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "1px",
                color: tema.sobreAcento,
                background: tema.acento,
                padding: "2px 7px",
              }}
            >
              {s.tag}
            </span>
          ) : null}
        </div>
        <div
          style={{
            fontFamily: narrow,
            fontSize: "13px",
            color: tema.textoSuave,
            marginTop: "6px",
            lineHeight: 1.4,
          }}
        >
          {s.descricao}
        </div>
        <div
          style={{
            fontFamily: narrow,
            fontSize: "12px",
            color: tema.textoSuave,
            marginTop: "6px",
          }}
        >
          {s.inclui.join(" / ")}
        </div>
      </div>
      <div
        style={{
          fontFamily: archivo,
          fontSize: "46px",
          fontWeight: 900,
          letterSpacing: "-2px",
          lineHeight: 0.85,
          color: tema.acentoTextoGrande,
          whiteSpace: "nowrap",
        }}
      >
        {c.fmt(s.valor)}
      </div>
    </div>
  );

  return (
    <div
      style={{
        background: tema.fundo,
        color: tema.texto,
        padding: "44px 42px",
        fontFamily: narrow,
      }}
    >
      {/* Cabeçalho: nome em Archivo 900 gigante, régua vermelha */}
      <div
        style={{
          borderBottom: `3px solid ${tema.acento}`,
          paddingBottom: "20px",
          marginBottom: "34px",
        }}
      >
        <div
          style={{
            fontFamily: narrow,
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: tema.acentoTexto,
          }}
        >
          {c.tagline} — {c.moeda}
        </div>
        <div
          style={{
            fontFamily: archivo,
            fontSize: "72px",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "-3px",
            lineHeight: 0.82,
            color: tema.texto,
            marginTop: "12px",
          }}
        >
          Studio
          <br />
          Exemplo
          <span style={{ color: tema.acento }}>.</span>
        </div>
        <div
          style={{
            fontFamily: narrow,
            fontSize: "13px",
            color: tema.textoSuave,
            marginTop: "16px",
            maxWidth: "70%",
            lineHeight: 1.5,
          }}
        >
          {c.intro}
        </div>
      </div>

      {secao(
        "01",
        c.secoes.servicosTitulo,
        <div>
          {PrecoServico(c.landing[0])}
          {PrecoServico(c.landing[1])}
          {PrecoServico(c.institucional[0])}
          {PrecoServico(c.institucional[1], true)}
        </div>,
      )}

      {secao(
        "02",
        c.secoes.bancoHorasTitulo,
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0" }}>
          {c.horas.map((h, i) => (
            <div
              key={h.nome}
              style={{
                borderLeft: i === 0 ? "none" : `2px solid ${tema.divisor}`,
                paddingLeft: i === 0 ? "0" : "16px",
                paddingRight: "12px",
              }}
            >
              <div
                style={{
                  fontFamily: narrow,
                  fontSize: "12px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: tema.textoSuave,
                }}
              >
                {h.nome}
              </div>
              <div
                style={{
                  fontFamily: archivo,
                  fontSize: "38px",
                  fontWeight: 900,
                  letterSpacing: "-1.5px",
                  color: tema.texto,
                  lineHeight: 0.9,
                  margin: "8px 0 4px",
                }}
              >
                {c.fmt(h.valor)}
              </div>
              <div style={{ fontFamily: narrow, fontSize: "12px", color: tema.acentoTexto }}>
                {h.unit} · {h.detalhe}
              </div>
            </div>
          ))}
        </div>,
      )}

      {secao(
        "03",
        c.secoes.projetosTitulo,
        <div
          style={{
            fontFamily: archivo,
            fontSize: "26px",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "-1px",
            lineHeight: 0.95,
            color: tema.texto,
          }}
        >
          <span style={{ color: tema.acento }}>→ </span>
          <span
            style={{
              fontFamily: narrow,
              fontSize: "14px",
              fontWeight: 400,
              textTransform: "none",
              letterSpacing: "0",
              color: tema.textoSuave,
              lineHeight: 1.5,
              display: "block",
              marginTop: "10px",
            }}
          >
            {c.secoes.projetosTexto}
          </span>
        </div>,
      )}

      {secao(
        "04",
        c.secoes.condicoesTitulo,
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
          {c.secoes.condicoes.map((t, i) => (
            <div
              key={i}
              style={{
                fontFamily: narrow,
                fontSize: "13px",
                color: tema.texto,
                display: "flex",
                gap: "10px",
                lineHeight: 1.4,
              }}
            >
              <span
                style={{
                  fontFamily: archivo,
                  fontSize: "16px",
                  fontWeight: 900,
                  color: tema.acento,
                  lineHeight: 1,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              {t}
            </div>
          ))}
        </div>,
      )}

      <div
        style={{
          fontFamily: narrow,
          fontSize: "11px",
          letterSpacing: "0.5px",
          textTransform: "uppercase",
          color: tema.textoSuave,
          borderTop: `2px solid ${tema.hairline}`,
          paddingTop: "14px",
        }}
      >
        {c.rodape}
      </div>
    </div>
  );
}

/** Mapa id → componente, consumido pela rota de preview. */
export const TEMPLATES_PREMIUM = {
  atelier_noir: TemplateAtelierNoir,
  blueprint_tecnico: TemplateBlueprintTecnico,
  swiss_studio: TemplateSwissStudio,
} as const;
