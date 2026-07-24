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
import type { CSSProperties, ReactNode } from "react";
import type { TemaTemplate } from "@/lib/templates-core";
import type { FONTES } from "@/lib/fontes-templates";
import { conteudoDemo, type ItemServico } from "./templates-premium-conteudo";

type Fontes = typeof FONTES;

export type TemplatePremiumProps = {
  tema: TemaTemplate;
  fontes: Fontes;
  idioma?: string;
};

/* ===========================================================================
 * A) ATELIER NOIR — editorial de luxo
 * ======================================================================== */
export function TemplateAtelierNoir({
  tema,
  fontes,
  idioma,
}: TemplatePremiumProps) {
  const c = conteudoDemo(idioma);
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

  const ServicoCard = (s: ItemServico) => (
    <div
      key={s.ordem}
      style={{
        background: tema.superficie,
        borderTop: `2px solid ${tema.secundario}`,
        borderRadius: tema.raio,
        padding: "22px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}
      >
        <div>
          <div
            style={{
              fontFamily: serif,
              fontSize: "21px",
              fontWeight: 700,
              color: tema.texto,
              lineHeight: 1.1,
            }}
          >
            {s.nome}
          </div>
          <div
            style={{
              fontFamily: sans,
              fontSize: "12px",
              color: tema.textoSuave,
              marginTop: "6px",
              lineHeight: 1.5,
            }}
          >
            {s.descricao}
          </div>
        </div>
        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          {s.tag ? (
            <div
              style={{
                fontFamily: sans,
                fontSize: "8px",
                letterSpacing: "1.5px",
                color: tema.sobreSecundario,
                background: tema.secundario,
                padding: "3px 7px",
                borderRadius: tema.raio,
                display: "inline-block",
                marginBottom: "8px",
                fontWeight: 700,
              }}
            >
              {s.tag}
            </div>
          ) : null}
          <div
            style={{
              fontFamily: serif,
              fontSize: "30px",
              fontWeight: 700,
              color: tema.acentoTextoGrande,
              lineHeight: 1,
            }}
          >
            {c.fmt(s.valor)}
          </div>
          <div
            style={{
              fontFamily: sans,
              fontSize: "9px",
              letterSpacing: "1px",
              color: tema.textoSuave,
              marginTop: "2px",
            }}
          >
            {c.moeda}
          </div>
        </div>
      </div>
      <div style={{ height: "1px", background: tema.hairline }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
        {s.inclui.map((it, i) => (
          <span
            key={i}
            style={{
              fontFamily: sans,
              fontSize: "11px",
              color: tema.textoSuave,
              display: "inline-flex",
              alignItems: "baseline",
              gap: "6px",
            }}
          >
            <span style={{ color: tema.acentoTexto }}>—</span>
            {it}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div
      style={{
        background: tema.fundo,
        color: tema.texto,
        padding: "48px 44px",
        fontFamily: sans,
      }}
    >
      {/* Cabeçalho editorial: nome do estúdio em serifada gigante como âncora. */}
      <div style={{ marginBottom: "40px" }}>
        {kicker(c.tagline)}
        <div
          style={{
            fontFamily: serif,
            fontSize: "62px",
            fontWeight: 700,
            lineHeight: 0.95,
            letterSpacing: "-1px",
            marginTop: "14px",
          }}
        >
          {c.estudio.split(" ")[0]}
          <br />
          <span style={{ fontStyle: "italic", color: tema.acentoTexto }}>
            {c.estudio.split(" ").slice(1).join(" ")}
          </span>
        </div>
        <div
          style={{
            fontSize: "12px",
            color: tema.textoSuave,
            maxWidth: "62%",
            marginTop: "18px",
            lineHeight: 1.6,
            borderLeft: `2px solid ${tema.secundario}`,
            paddingLeft: "14px",
          }}
        >
          {c.intro}
        </div>
      </div>

      {/* Serviços */}
      <div style={{ marginBottom: "18px" }}>{kicker(c.secoes.servicosTitulo)}</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "14px",
          marginBottom: "36px",
        }}
      >
        {[...c.landing, ...c.institucional].map(ServicoCard)}
      </div>

      {/* Banco de horas + Projetos especiais em duas colunas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: "14px",
          marginBottom: "36px",
        }}
      >
        <div
          style={{
            background: tema.superficie,
            borderRadius: tema.raio,
            padding: "24px",
          }}
        >
          <div style={{ marginBottom: "4px" }}>
            {kicker(c.secoes.bancoHorasTitulo)}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: tema.textoSuave,
              marginBottom: "16px",
            }}
          >
            {c.secoes.bancoHorasSub}
          </div>
          {c.horas.map((h, i) => (
            <div
              key={h.nome}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                padding: "11px 0",
                borderTop: i === 0 ? "none" : `1px solid ${tema.hairline}`,
              }}
            >
              <div>
                <div
                  style={{ fontSize: "13px", color: tema.texto, fontWeight: 500 }}
                >
                  {h.nome}
                </div>
                <div style={{ fontSize: "10px", color: tema.textoSuave }}>
                  {h.detalhe}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    fontFamily: serif,
                    fontSize: "18px",
                    fontWeight: 700,
                    color: tema.acentoTextoGrande,
                  }}
                >
                  {c.fmt(h.valor)}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    color: tema.textoSuave,
                    marginLeft: "6px",
                  }}
                >
                  {h.unit}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: tema.secundario,
            borderRadius: tema.raio,
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: sans,
              fontSize: "10px",
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: tema.sobreSecundario,
              fontWeight: 600,
              opacity: 0.85,
            }}
          >
            {c.secoes.projetosTitulo}
          </div>
          <div
            style={{
              fontFamily: serif,
              fontSize: "22px",
              fontWeight: 700,
              color: tema.sobreSecundario,
              margin: "12px 0",
              lineHeight: 1.15,
            }}
          >
            Sob medida.
          </div>
          <div
            style={{
              fontSize: "11.5px",
              color: tema.sobreSecundario,
              opacity: 0.9,
              lineHeight: 1.6,
            }}
          >
            {c.secoes.projetosTexto}
          </div>
        </div>
      </div>

      {/* Condições comerciais */}
      <div style={{ marginBottom: "14px" }}>
        {kicker(c.secoes.condicoesTitulo)}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px 28px",
          marginBottom: "40px",
        }}
      >
        {c.secoes.condicoes.map((t, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: "12px",
              fontSize: "12px",
              color: tema.textoSuave,
              lineHeight: 1.5,
            }}
          >
            <span
              style={{
                fontFamily: serif,
                fontSize: "16px",
                color: tema.acentoTexto,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            {t}
          </div>
        ))}
      </div>

      <div
        style={{
          borderTop: `1px solid ${tema.hairline}`,
          paddingTop: "16px",
          fontSize: "10px",
          letterSpacing: "0.5px",
          color: tema.textoSuave,
          textAlign: "center",
        }}
      >
        {c.rodape}
      </div>
    </div>
  );
}

/* ===========================================================================
 * B) BLUEPRINT TÉCNICO — spec sheet
 * ======================================================================== */
export function TemplateBlueprintTecnico({
  tema,
  fontes,
  idioma,
}: TemplatePremiumProps) {
  const c = conteudoDemo(idioma);
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

  const SpecRow = (s: ItemServico, destaque = false) => (
    <div
      key={s.ordem}
      style={{
        display: "grid",
        gridTemplateColumns: "44px 1fr 130px",
        alignItems: "center",
        gap: "16px",
        padding: "16px 18px",
        background: tema.superficie,
        border: `1px solid ${destaque ? tema.acento : tema.hairline}`,
        borderLeft: `3px solid ${destaque ? tema.acento : tema.secundario}`,
      }}
    >
      <div
        style={{
          fontFamily: mono,
          fontSize: "13px",
          color: tema.textoSuave,
        }}
      >
        {s.ordem}
      </div>
      <div>
        <div
          style={{
            fontFamily: grotesk,
            fontSize: "16px",
            fontWeight: 700,
            color: tema.texto,
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          {s.nome}
          {s.tag ? (
            <span
              style={{
                fontFamily: mono,
                fontSize: "8px",
                letterSpacing: "1px",
                color: tema.sobreAcento,
                background: tema.acento,
                padding: "2px 6px",
              }}
            >
              {s.tag}
            </span>
          ) : null}
        </div>
        <div
          style={{
            fontFamily: mono,
            fontSize: "10.5px",
            color: tema.textoSuave,
            marginTop: "5px",
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 10px",
          }}
        >
          {s.inclui.map((it, i) => (
            <span key={i}>[{it}]</span>
          ))}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <span
          style={{
            fontFamily: mono,
            fontSize: "22px",
            fontWeight: 700,
            color: tema.texto,
          }}
        >
          {c.fmt(s.valor)}
        </span>
        <div
          style={{
            fontFamily: mono,
            fontSize: "9px",
            color: tema.textoSuave,
            letterSpacing: "1px",
          }}
        >
          {c.moeda}
        </div>
      </div>
    </div>
  );

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
      {/* Cabeçalho com moldura técnica e marcas "+" nos cantos */}
      <div
        style={{
          position: "relative",
          border: `1px solid ${tema.hairline}`,
          padding: "28px 26px",
          marginBottom: "34px",
          background: tema.superficie,
        }}
      >
        <Marca top="-7px" left="-7px" />
        <Marca top="-7px" right="-7px" />
        <Marca bottom="-7px" left="-7px" />
        <Marca bottom="-7px" right="-7px" />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            {label("// " + c.tagline)}
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
              {c.estudio}
              <span style={{ color: tema.acentoTexto }}>.</span>
            </div>
          </div>
          <div style={{ textAlign: "right", paddingTop: "4px" }}>
            <div style={{ marginBottom: "4px" }}>{label("REF")}</div>
            <div style={{ fontFamily: mono, fontSize: "13px", color: tema.texto }}>
              STD-EXE-2026
            </div>
            <div
              style={{
                fontFamily: mono,
                fontSize: "13px",
                color: tema.secundarioTexto,
                marginTop: "4px",
              }}
            >
              {c.moeda} · USD
            </div>
          </div>
        </div>
        <div
          style={{
            fontFamily: mono,
            fontSize: "11px",
            color: tema.textoSuave,
            marginTop: "16px",
            lineHeight: 1.6,
            maxWidth: "80%",
          }}
        >
          {c.intro}
        </div>
      </div>

      {/* Serviços — spec rows */}
      <div style={{ marginBottom: "12px" }}>{label("01 / " + c.secoes.servicosTitulo)}</div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginBottom: "32px",
        }}
      >
        {SpecRow(c.landing[0])}
        {SpecRow(c.landing[1], true)}
        {SpecRow(c.institucional[0])}
        {SpecRow(c.institucional[1], true)}
      </div>

      {/* Banco de horas — âmbar nos preços */}
      <div style={{ marginBottom: "12px" }}>
        {label("02 / " + c.secoes.bancoHorasTitulo)}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "8px",
          marginBottom: "32px",
        }}
      >
        {c.horas.map((h) => (
          <div
            key={h.nome}
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
              {h.nome}
            </div>
            <div
              style={{
                fontFamily: mono,
                fontSize: "26px",
                fontWeight: 700,
                color: tema.secundarioTexto,
                margin: "8px 0 2px",
              }}
            >
              {c.fmt(h.valor)}
            </div>
            <div style={{ fontFamily: mono, fontSize: "10px", color: tema.textoSuave }}>
              {h.unit} · {h.detalhe}
            </div>
          </div>
        ))}
      </div>

      {/* Projetos especiais + condições em duas colunas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
        }}
      >
        <div
          style={{
            border: `1px solid ${tema.acento}`,
            padding: "22px 20px",
            background: tema.superficie,
          }}
        >
          <div style={{ marginBottom: "10px" }}>
            {label("03 / " + c.secoes.projetosTitulo)}
          </div>
          <div
            style={{
              fontFamily: mono,
              fontSize: "11.5px",
              color: tema.textoSuave,
              lineHeight: 1.7,
            }}
          >
            {c.secoes.projetosTexto}
          </div>
        </div>
        <div
          style={{
            border: `1px solid ${tema.hairline}`,
            padding: "22px 20px",
            background: tema.superficie,
          }}
        >
          <div style={{ marginBottom: "12px" }}>
            {label("04 / " + c.secoes.condicoesTitulo)}
          </div>
          {c.secoes.condicoes.map((t, i) => (
            <div
              key={i}
              style={{
                fontFamily: mono,
                fontSize: "11px",
                color: tema.textoSuave,
                display: "flex",
                gap: "10px",
                padding: "5px 0",
                lineHeight: 1.5,
              }}
            >
              <span style={{ color: tema.acentoTexto }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              {t}
            </div>
          ))}
        </div>
      </div>

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
        {c.rodape}
      </div>
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
}: TemplatePremiumProps) {
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
