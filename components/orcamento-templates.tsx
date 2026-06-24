/**
 * Templates visuais do PDF de orçamento.
 *
 * Cada template é um componente puro que recebe os mesmos dados (form, total,
 * plano de pagamento, tenant, cores, rótulos do idioma e formatador de moeda)
 * e renderiza um layout diferente. A prévia em tela e o PDF (gerado via
 * html2canvas sobre o mesmo nó) usam exatamente este markup — por isso tudo é
 * estilizado inline.
 *
 *   classico -> formal, preto e branco, tipografia limpa (layout original)
 *   moderno  -> cores da marca do tenant, cabeçalho colorido, sofisticado
 *   simples  -> ultra compacto, sem tabelas, direto ao ponto
 */
import type { Tenant } from "@/lib/types";
import type { Dict } from "@/lib/i18n";
// Import apenas de tipos (apagado em runtime) — não cria ciclo de import.
import type { FormState, PlanoPagamento } from "./orcamentos-manager";

export type TipoTemplate = "classico" | "moderno" | "simples";

export type TemplateProps = {
  form: FormState;
  total: number;
  plano: PlanoPagamento;
  tenant: Tenant | null;
  cor: string;
  corSuave: string;
  numero: string;
  dataHoje: string;
  dict: Dict;
  fmt: (v: number) => string;
};

/* ===========================================================================
 * 1) CLÁSSICO — layout formal original
 * ======================================================================== */
export function TemplateClassico({
  form,
  total,
  plano,
  tenant,
  cor,
  corSuave,
  numero,
  dataHoje,
  dict,
  fmt,
}: TemplateProps) {
  return (
    <div style={{ padding: "40px", fontSize: "13px", lineHeight: 1.5 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "32px",
          paddingBottom: "24px",
          borderBottom: `2px solid ${cor}`,
        }}
      >
        <div>
          {tenant?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logo_url}
              alt={tenant.nome_empresa}
              style={{ height: "56px", width: "auto", display: "block" }}
              crossOrigin="anonymous"
            />
          ) : (
            <div
              style={{
                fontSize: "22px",
                fontWeight: 800,
                color: cor,
                letterSpacing: "0.5px",
              }}
            >
              {tenant?.nome_empresa || "Sua Empresa"}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#111",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            {dict.pdf.titulo}
          </div>
          <div style={{ color: "#666", fontSize: "12px", marginTop: "4px" }}>
            {dict.pdf.numero} {numero}
          </div>
          <div style={{ color: "#666", fontSize: "12px" }}>
            {dict.pdf.data}: {dataHoje}
          </div>
          <div style={{ color: "#666", fontSize: "12px" }}>
            {dict.pdf.validade}: {dict.pdf.validadeVal}
          </div>
        </div>
      </div>

      {/* Cliente */}
      <div
        style={{
          marginBottom: "28px",
          background: corSuave,
          borderRadius: "8px",
          padding: "16px",
          borderLeft: `4px solid ${cor}`,
        }}
      >
        <div style={{ fontWeight: 700, color: cor, marginBottom: "8px" }}>
          {dict.pdf.cliente}
        </div>
        <div style={{ fontWeight: 600 }}>
          {form.cliente_nome || dict.pdf.nomeCliente}
        </div>
        {form.cliente_email && (
          <div style={{ color: "#555" }}>{form.cliente_email}</div>
        )}
        {form.cliente_telefone && (
          <div style={{ color: "#555" }}>{form.cliente_telefone}</div>
        )}
      </div>

      {/* Serviços */}
      <div style={{ marginBottom: "28px" }}>
        <div
          style={{
            fontWeight: 700,
            color: cor,
            marginBottom: "12px",
            textTransform: "uppercase",
            fontSize: "11px",
            letterSpacing: "1px",
          }}
        >
          {dict.pdf.servicos}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: cor, color: "#fff" }}>
              <th
                style={{
                  padding: "10px 12px",
                  textAlign: "left",
                  fontWeight: 600,
                  fontSize: "12px",
                }}
              >
                {dict.pdf.servico}
              </th>
              <th
                style={{
                  padding: "10px 12px",
                  textAlign: "right",
                  fontWeight: 600,
                  fontSize: "12px",
                  width: "140px",
                }}
              >
                {dict.pdf.valor}
              </th>
            </tr>
          </thead>
          <tbody>
            {form.servicos
              .filter((s) => s.descricao || s.valor)
              .map((s, i) => (
                <tr
                  key={s.id}
                  style={{ background: i % 2 === 0 ? "#fff" : corSuave }}
                >
                  <td
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    {s.descricao || dict.orc.servicoN(i + 1)}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      textAlign: "right",
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    {fmt(parseFloat(s.valor) || 0)}
                  </td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr style={{ background: corSuave }}>
              <td style={{ padding: "12px", fontWeight: 700, fontSize: "14px" }}>
                {dict.pdf.total}
              </td>
              <td
                style={{
                  padding: "12px",
                  textAlign: "right",
                  fontWeight: 800,
                  fontSize: "16px",
                  color: cor,
                }}
              >
                {fmt(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Condições de pagamento */}
      <div
        style={{
          marginBottom: "24px",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: corSuave,
            padding: "10px 16px",
            fontWeight: 700,
            color: cor,
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {dict.pdf.pagamento}
        </div>
        <div style={{ padding: "16px" }}>
          {plano.tipo === "unico" && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "13px", color: "#555" }}>
                {dict.pdf.pagamentoAVista}
              </span>
              <span style={{ fontSize: "22px", fontWeight: 800, color: cor }}>
                {fmt(total)}
              </span>
            </div>
          )}

          {plano.tipo === "entrada_restante" && (
            <>
              <div style={{ display: "flex", gap: "16px" }}>
                <div
                  style={{
                    flex: 1,
                    textAlign: "center",
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    padding: "16px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#666",
                      marginBottom: "4px",
                    }}
                  >
                    {dict.pdf.entradaPct(plano.pct)}
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: cor }}>
                    {fmt(plano.entrada)}
                  </div>
                </div>
                <div
                  style={{
                    flex: 1,
                    textAlign: "center",
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    padding: "16px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#666",
                      marginBottom: "4px",
                    }}
                  >
                    {dict.pdf.restantePct(Number((100 - plano.pct).toFixed(0)))}
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: cor }}>
                    {fmt(plano.restante)}
                  </div>
                </div>
              </div>
              <div
                style={{
                  marginTop: "12px",
                  fontSize: "11px",
                  color: "#888",
                  textAlign: "center",
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
                  marginBottom: "10px",
                  fontSize: "12px",
                  color: "#555",
                }}
              >
                {plano.subtipo === "entrada_diferenciada"
                  ? dict.pdf.parceladoEntradaDif(plano.n)
                  : dict.pdf.parceladoIguais(plano.n)}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {plano.parcelas.map((p) => (
                    <tr key={p.numero}>
                      <td
                        style={{
                          padding: "8px 12px",
                          borderBottom: "1px solid #eee",
                          fontSize: "12px",
                          color: "#444",
                        }}
                      >
                        {p.entrada
                          ? dict.pdf.entradaPrimeira
                          : dict.pdf.parcelaN(p.numero)}
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          borderBottom: "1px solid #eee",
                          textAlign: "right",
                          fontWeight: 700,
                          color: cor,
                          fontSize: "13px",
                        }}
                      >
                        {fmt(p.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {/* Nota adicional */}
      {form.nota && (
        <div
          style={{
            marginBottom: "24px",
            padding: "12px 16px",
            background: "#fffbf0",
            border: "1px solid #ffe080",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#555",
          }}
        >
          {form.nota}
        </div>
      )}

      {/* Rodapé */}
      <div
        style={{
          marginTop: "40px",
          textAlign: "center",
          borderTop: "1px solid #eee",
          paddingTop: "16px",
        }}
      >
        <div style={{ color: "#888", fontSize: "12px" }}>{dict.pdf.rodape}</div>
        {tenant && (
          <div
            style={{
              marginTop: "6px",
              color: "#aaa",
              fontSize: "10px",
              letterSpacing: "0.3px",
            }}
          >
            {[tenant.nome_empresa, tenant.email, tenant.telefone]
              .filter(Boolean)
              .join(" | ")}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===========================================================================
 * 2) MODERNO — cores da marca do tenant, cabeçalho colorido, sofisticado
 * ======================================================================== */
export function TemplateModerno({
  form,
  total,
  plano,
  tenant,
  cor,
  corSuave,
  numero,
  dataHoje,
  dict,
  fmt,
}: TemplateProps) {
  return (
    <div style={{ fontSize: "13px", lineHeight: 1.5 }}>
      {/* Faixa de cabeçalho na cor da marca */}
      <div
        style={{
          background: cor,
          color: "#fff",
          padding: "36px 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          {tenant?.logo_url ? (
            // Logo dentro de um "chip" branco para preservar cores originais.
            <div
              style={{
                background: "#fff",
                borderRadius: "8px",
                padding: "8px 12px",
                display: "inline-block",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tenant.logo_url}
                alt={tenant.nome_empresa}
                style={{ height: "44px", width: "auto", display: "block" }}
                crossOrigin="anonymous"
              />
            </div>
          ) : (
            <div
              style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "0.5px" }}
            >
              {tenant?.nome_empresa || "Sua Empresa"}
            </div>
          )}
          {tenant?.nome_profissional && (
            <div style={{ marginTop: "8px", fontSize: "12px", opacity: 0.85 }}>
              {tenant.nome_profissional}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "26px",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "2px",
            }}
          >
            {dict.pdf.titulo}
          </div>
          <div style={{ fontSize: "12px", marginTop: "8px", opacity: 0.9 }}>
            {dict.pdf.numero} {numero}
          </div>
          <div style={{ fontSize: "12px", opacity: 0.9 }}>
            {dict.pdf.data}: {dataHoje}
          </div>
          <div style={{ fontSize: "12px", opacity: 0.9 }}>
            {dict.pdf.validade}: {dict.pdf.validadeVal}
          </div>
        </div>
      </div>

      <div style={{ padding: "32px 40px" }}>
        {/* Cliente */}
        <div
          style={{
            marginBottom: "28px",
            background: corSuave,
            borderRadius: "12px",
            padding: "20px",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              color: cor,
              marginBottom: "8px",
              textTransform: "uppercase",
              fontSize: "11px",
              letterSpacing: "1px",
            }}
          >
            {dict.pdf.cliente}
          </div>
          <div style={{ fontWeight: 700, fontSize: "16px" }}>
            {form.cliente_nome || dict.pdf.nomeCliente}
          </div>
          {(form.cliente_email || form.cliente_telefone) && (
            <div style={{ color: "#555", marginTop: "4px" }}>
              {[form.cliente_email, form.cliente_telefone]
                .filter(Boolean)
                .join("  ·  ")}
            </div>
          )}
        </div>

        {/* Serviços */}
        <div style={{ marginBottom: "24px" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              borderRadius: "12px",
              overflow: "hidden",
              border: `1px solid ${corSuave}`,
            }}
          >
            <thead>
              <tr style={{ background: cor, color: "#fff" }}>
                <th
                  style={{
                    padding: "14px 16px",
                    textAlign: "left",
                    fontWeight: 600,
                    fontSize: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {dict.pdf.servico}
                </th>
                <th
                  style={{
                    padding: "14px 16px",
                    textAlign: "right",
                    fontWeight: 600,
                    fontSize: "12px",
                    width: "150px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {dict.pdf.valor}
                </th>
              </tr>
            </thead>
            <tbody>
              {form.servicos
                .filter((s) => s.descricao || s.valor)
                .map((s, i) => (
                  <tr
                    key={s.id}
                    style={{ background: i % 2 === 0 ? "#fff" : corSuave }}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      {s.descricao || dict.orc.servicoN(i + 1)}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        textAlign: "right",
                        fontWeight: 600,
                      }}
                    >
                      {fmt(parseFloat(s.valor) || 0)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Total em destaque */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: cor,
            color: "#fff",
            borderRadius: "12px",
            padding: "18px 24px",
            marginBottom: "24px",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              textTransform: "uppercase",
              letterSpacing: "1px",
              fontWeight: 600,
            }}
          >
            {dict.pdf.total}
          </span>
          <span style={{ fontSize: "26px", fontWeight: 800 }}>
            {fmt(total)}
          </span>
        </div>

        {/* Condições de pagamento */}
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              fontWeight: 700,
              color: cor,
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: "12px",
            }}
          >
            {dict.pdf.pagamento}
          </div>

          {plano.tipo === "unico" && (
            <div style={{ fontSize: "13px", color: "#555" }}>
              {dict.pdf.pagamentoAVistaValor(fmt(total))}
            </div>
          )}

          {plano.tipo === "entrada_restante" && (
            <div style={{ display: "flex", gap: "16px" }}>
              <div
                style={{
                  flex: 1,
                  textAlign: "center",
                  background: corSuave,
                  borderRadius: "12px",
                  padding: "16px",
                }}
              >
                <div
                  style={{ fontSize: "11px", color: "#666", marginBottom: "4px" }}
                >
                  {dict.pdf.entradaPct(plano.pct)}
                </div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: cor }}>
                  {fmt(plano.entrada)}
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  textAlign: "center",
                  background: corSuave,
                  borderRadius: "12px",
                  padding: "16px",
                }}
              >
                <div
                  style={{ fontSize: "11px", color: "#666", marginBottom: "4px" }}
                >
                  {dict.pdf.restantePct(Number((100 - plano.pct).toFixed(0)))}
                </div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: cor }}>
                  {fmt(plano.restante)}
                </div>
              </div>
            </div>
          )}

          {plano.tipo === "parcelado" && (
            <>
              <div
                style={{ marginBottom: "10px", fontSize: "12px", color: "#555" }}
              >
                {plano.subtipo === "entrada_diferenciada"
                  ? dict.pdf.parceladoEntradaDif(plano.n)
                  : dict.pdf.parceladoIguais(plano.n)}
              </div>
              <div
                style={{
                  borderRadius: "12px",
                  overflow: "hidden",
                  border: `1px solid ${corSuave}`,
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {plano.parcelas.map((p, i) => (
                      <tr
                        key={p.numero}
                        style={{ background: i % 2 === 0 ? "#fff" : corSuave }}
                      >
                        <td
                          style={{
                            padding: "10px 16px",
                            fontSize: "12px",
                            color: "#444",
                          }}
                        >
                          {p.entrada
                            ? dict.pdf.entradaPrimeira
                            : dict.pdf.parcelaN(p.numero)}
                        </td>
                        <td
                          style={{
                            padding: "10px 16px",
                            textAlign: "right",
                            fontWeight: 700,
                            color: cor,
                            fontSize: "13px",
                          }}
                        >
                          {fmt(p.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Nota adicional */}
        {form.nota && (
          <div
            style={{
              marginBottom: "24px",
              padding: "14px 18px",
              background: corSuave,
              borderLeft: `4px solid ${cor}`,
              borderRadius: "8px",
              fontSize: "12px",
              color: "#555",
            }}
          >
            {form.nota}
          </div>
        )}

        {/* Rodapé */}
        <div
          style={{
            marginTop: "32px",
            textAlign: "center",
            borderTop: `2px solid ${corSuave}`,
            paddingTop: "16px",
          }}
        >
          <div style={{ color: cor, fontSize: "12px", fontWeight: 600 }}>
            {dict.pdf.rodape}
          </div>
          {tenant && (
            <div
              style={{
                marginTop: "6px",
                color: "#999",
                fontSize: "10px",
                letterSpacing: "0.3px",
              }}
            >
              {[tenant.nome_empresa, tenant.email, tenant.telefone]
                .filter(Boolean)
                .join(" | ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===========================================================================
 * 3) SIMPLES — ultra compacto, sem tabelas, direto ao ponto
 * ======================================================================== */
export function TemplateSimples({
  form,
  total,
  plano,
  tenant,
  numero,
  dataHoje,
  dict,
  fmt,
}: TemplateProps) {
  return (
    <div
      style={{
        padding: "32px 36px",
        fontSize: "13px",
        lineHeight: 1.45,
        color: "#222",
      }}
    >
      {/* Topo: empresa + número/data em uma linha */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          borderBottom: "2px solid #111",
          paddingBottom: "10px",
          marginBottom: "18px",
        }}
      >
        <div style={{ fontSize: "18px", fontWeight: 700 }}>
          {tenant?.nome_empresa || "Sua Empresa"}
        </div>
        <div style={{ fontSize: "12px", color: "#555", textAlign: "right" }}>
          <div>
            <strong>{dict.pdf.titulo}</strong> {numero}
          </div>
          <div>{dataHoje}</div>
        </div>
      </div>

      {/* Cliente em uma linha */}
      <div style={{ marginBottom: "18px" }}>
        <strong>{dict.pdf.cliente}:</strong> {form.cliente_nome || "—"}
        {form.cliente_telefone ? `  ·  ${form.cliente_telefone}` : ""}
        {form.cliente_email ? `  ·  ${form.cliente_email}` : ""}
      </div>

      {/* Serviços como lista simples (sem tabela) */}
      <div style={{ marginBottom: "8px" }}>
        {form.servicos
          .filter((s) => s.descricao || s.valor)
          .map((s, i) => (
            <div
              key={s.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                padding: "8px 0",
                borderBottom: "1px dashed #ccc",
              }}
            >
              <span>{s.descricao || dict.orc.servicoN(i + 1)}</span>
              <span
                style={{
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  marginLeft: "16px",
                }}
              >
                {fmt(parseFloat(s.valor) || 0)}
              </span>
            </div>
          ))}
      </div>

      {/* Total */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          borderTop: "2px solid #111",
          paddingTop: "10px",
          marginTop: "8px",
          marginBottom: "16px",
        }}
      >
        <span
          style={{
            fontSize: "15px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {dict.pdf.total}
        </span>
        <span style={{ fontSize: "20px", fontWeight: 800 }}>
          {fmt(total)}
        </span>
      </div>

      {/* Pagamento em uma linha (resumo do plano) */}
      <div style={{ fontSize: "12px", color: "#444", marginBottom: "10px" }}>
        <strong>{dict.pdf.pagamento}:</strong> {plano.resumo}
      </div>

      {/* Nota */}
      {form.nota && (
        <div style={{ fontSize: "12px", color: "#555", marginBottom: "10px" }}>
          {form.nota}
        </div>
      )}

      {/* Rodapé minimalista */}
      <div style={{ marginTop: "24px", fontSize: "11px", color: "#999" }}>
        {[tenant?.nome_empresa, tenant?.email, tenant?.telefone]
          .filter(Boolean)
          .join("  ·  ")}
      </div>
    </div>
  );
}
