// Suíte de testes da lógica NOVA de segurança adicionada nesta rodada.
// Executar: node --test tests.js
//
// Cobre apenas lógica PURA e determinística (sem rede/DB): a validação de
// upload de logo (item 4) e o núcleo da trilha de auditoria de pagamentos
// (item 3). Rate limiting (item 1) e sanitização de erro (item 2) dependem de
// Redis/rotas e são verificados via build + runtime, não aqui.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validarArquivoLogo,
  LOGO_MIME_PERMITIDOS,
  LOGO_TAMANHO_MAX_BYTES,
} from "./lib/upload-validation.js";

import {
  mapStatusParaEvento,
  construirRegistroAuditoria,
} from "./lib/payment-audit-core.js";

import {
  normalizarPais,
  moedaAssinatura,
  idiomaDoPais,
  paisDoIdioma,
  idiomaPorPaisIp,
  authDomainMp,
  configFormatoMoeda,
  precoAssinatura,
  PRECOS_ASSINATURA,
} from "./lib/mp-paises.js";

const KB = 1024;

// ---------------------------------------------------------------------------
// Item 4 — validação de upload de logo
// ---------------------------------------------------------------------------

test("aceita PNG dentro do limite", () => {
  assert.deepEqual(
    validarArquivoLogo({ type: "image/png", size: 500 * KB }),
    { ok: true },
  );
});

test("aceita JPEG dentro do limite", () => {
  assert.equal(validarArquivoLogo({ type: "image/jpeg", size: 10 * KB }).ok, true);
});

test("aceita WEBP dentro do limite", () => {
  assert.equal(validarArquivoLogo({ type: "image/webp", size: 10 * KB }).ok, true);
});

test("normaliza MIME em maiúsculas para aceitar", () => {
  assert.equal(validarArquivoLogo({ type: "IMAGE/PNG", size: 10 * KB }).ok, true);
});

test("rejeita GIF (fora da allowlist)", () => {
  const r = validarArquivoLogo({ type: "image/gif", size: 10 * KB });
  assert.deepEqual(r, { ok: false, motivo: "tipo" });
});

test("rejeita SVG (vetor de XSS)", () => {
  assert.deepEqual(
    validarArquivoLogo({ type: "image/svg+xml", size: 1 * KB }),
    { ok: false, motivo: "tipo" },
  );
});

test("rejeita PDF disfarçado", () => {
  assert.equal(validarArquivoLogo({ type: "application/pdf", size: 1 * KB }).motivo, "tipo");
});

test("rejeita tipo vazio", () => {
  assert.equal(validarArquivoLogo({ type: "", size: 1 * KB }).motivo, "tipo");
});

test("rejeita arquivo ausente", () => {
  assert.deepEqual(validarArquivoLogo(null), { ok: false, motivo: "ausente" });
  assert.deepEqual(validarArquivoLogo(undefined), { ok: false, motivo: "ausente" });
});

test("aceita exatamente no limite de 2 MB", () => {
  assert.equal(
    validarArquivoLogo({ type: "image/png", size: LOGO_TAMANHO_MAX_BYTES }).ok,
    true,
  );
});

test("rejeita 1 byte acima de 2 MB", () => {
  assert.deepEqual(
    validarArquivoLogo({ type: "image/png", size: LOGO_TAMANHO_MAX_BYTES + 1 }),
    { ok: false, motivo: "tamanho" },
  );
});

test("rejeita arquivo de tamanho zero", () => {
  assert.equal(validarArquivoLogo({ type: "image/png", size: 0 }).motivo, "tamanho");
});

test("LOGO_MIME_PERMITIDOS não inclui svg", () => {
  assert.ok(!LOGO_MIME_PERMITIDOS.includes("image/svg+xml"));
  assert.deepEqual(LOGO_MIME_PERMITIDOS, ["image/jpeg", "image/png", "image/webp"]);
});

// ---------------------------------------------------------------------------
// Item 3 — núcleo da trilha de auditoria
// ---------------------------------------------------------------------------

test("mapStatusParaEvento: approved -> aprovado", () => {
  assert.equal(mapStatusParaEvento("approved"), "aprovado");
});

test("mapStatusParaEvento: pending/in_process/authorized -> pendente", () => {
  assert.equal(mapStatusParaEvento("pending"), "pendente");
  assert.equal(mapStatusParaEvento("in_process"), "pendente");
  assert.equal(mapStatusParaEvento("authorized"), "pendente");
});

test("mapStatusParaEvento: rejected/cancelled/refunded/charged_back -> rejeitado", () => {
  for (const s of ["rejected", "cancelled", "refunded", "charged_back"]) {
    assert.equal(mapStatusParaEvento(s), "rejeitado");
  }
});

test("mapStatusParaEvento: desconhecido/nulo -> status_desconhecido", () => {
  assert.equal(mapStatusParaEvento("qualquer_coisa"), "status_desconhecido");
  assert.equal(mapStatusParaEvento(null), "status_desconhecido");
  assert.equal(mapStatusParaEvento(undefined), "status_desconhecido");
});

test("construirRegistroAuditoria: coage id numérico para string e deriva evento do status", () => {
  const r = construirRegistroAuditoria({
    origem: "assinatura",
    mpPaymentId: 123456789,
    externalReference: "pro:cliente@x.com",
    status: "approved",
    valor: "199.90",
  });
  assert.equal(r.mp_payment_id, "123456789");
  assert.equal(r.evento, "aprovado");
  assert.equal(r.valor, 199.9);
  assert.equal(r.origem, "assinatura");
  assert.equal(r.external_reference, "pro:cliente@x.com");
  assert.deepEqual(r.detalhe, {});
});

test("construirRegistroAuditoria: valor inválido vira null e tenant/id ausentes viram null", () => {
  const r = construirRegistroAuditoria({ evento: "pendente", valor: "abc" });
  assert.equal(r.valor, null);
  assert.equal(r.tenant_id, null);
  assert.equal(r.mp_payment_id, null);
  assert.equal(r.external_reference, null);
  assert.equal(r.status, null);
  assert.equal(r.evento, "pendente");
});

test("construirRegistroAuditoria: preserva só o detalhe essencial informado", () => {
  const r = construirRegistroAuditoria({
    evento: "aprovado",
    tenantId: "tnt-1",
    detalhe: { renovacao: true, plano: "pro", periodo: "anual" },
  });
  assert.equal(r.tenant_id, "tnt-1");
  assert.deepEqual(r.detalhe, { renovacao: true, plano: "pro", periodo: "anual" });
});

test("construirRegistroAuditoria: entrada vazia ainda produz registro válido", () => {
  const r = construirRegistroAuditoria({});
  assert.equal(r.evento, "status_desconhecido");
  assert.equal(r.valor, null);
  assert.deepEqual(r.detalhe, {});
});

// ---------------------------------------------------------------------------
// Multi-país Mercado Pago (AR / BR) — seleção país → gaveta → moeda → preço
// ---------------------------------------------------------------------------

test("normalizarPais: aceita AR e BR (inclusive minúsculas e com espaços)", () => {
  assert.equal(normalizarPais("BR"), "BR");
  assert.equal(normalizarPais("AR"), "AR");
  assert.equal(normalizarPais("br"), "BR");
  assert.equal(normalizarPais("  ar  "), "AR");
});

test("normalizarPais: valor desconhecido/nulo cai no default AR (fluxo legado)", () => {
  assert.equal(normalizarPais("US"), "AR");
  assert.equal(normalizarPais(""), "AR");
  assert.equal(normalizarPais(null), "AR");
  assert.equal(normalizarPais(undefined), "AR");
});

test("normalizarPais: default customizável para BR quando desejado", () => {
  assert.equal(normalizarPais(null, "BR"), "BR");
  assert.equal(normalizarPais("xx", "BR"), "BR");
  // Um valor válido sempre vence o default informado.
  assert.equal(normalizarPais("AR", "BR"), "AR");
});

test("moedaAssinatura: BR → BRL, AR → ARS, desconhecido → ARS", () => {
  assert.equal(moedaAssinatura("BR"), "BRL");
  assert.equal(moedaAssinatura("AR"), "ARS");
  assert.equal(moedaAssinatura("zz"), "ARS");
});

test("configFormatoMoeda: BRL → pt-BR/BRL com centavos", () => {
  assert.deepEqual(configFormatoMoeda("BRL"), {
    locale: "pt-BR",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
  // Tolera caixa e espaços da coluna.
  assert.deepEqual(configFormatoMoeda("  brl "), {
    locale: "pt-BR",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
});

test("configFormatoMoeda: ARS/desconhecido/nulo → es-AR/ARS sem centavos (legado)", () => {
  const esperado = { locale: "es-AR", currency: "ARS", maximumFractionDigits: 0 };
  assert.deepEqual(configFormatoMoeda("ARS"), esperado);
  assert.deepEqual(configFormatoMoeda("zz"), esperado);
  assert.deepEqual(configFormatoMoeda(""), esperado);
  assert.deepEqual(configFormatoMoeda(null), esperado);
  assert.deepEqual(configFormatoMoeda(undefined), esperado);
});

test("idiomaDoPais: BR → pt, AR → es", () => {
  assert.equal(idiomaDoPais("BR"), "pt");
  assert.equal(idiomaDoPais("AR"), "es");
});

test("paisDoIdioma: pt → BR, es → AR, desconhecido → AR", () => {
  assert.equal(paisDoIdioma("pt"), "BR");
  assert.equal(paisDoIdioma("es"), "AR");
  assert.equal(paisDoIdioma("en"), "AR");
});

test("idiomaPorPaisIp: BR (x-vercel-ip-country) → pt, tolerando caixa/espaços", () => {
  assert.equal(idiomaPorPaisIp("BR"), "pt");
  assert.equal(idiomaPorPaisIp("br"), "pt");
  assert.equal(idiomaPorPaisIp("  BR  "), "pt");
});

test("idiomaPorPaisIp: qualquer outro país → es (fluxo padrão AR)", () => {
  assert.equal(idiomaPorPaisIp("AR"), "es");
  assert.equal(idiomaPorPaisIp("US"), "es");
  // Portugal fala português mas NÃO é o mercado BR (moeda/credenciais MP Brasil).
  assert.equal(idiomaPorPaisIp("PT"), "es");
});

test("idiomaPorPaisIp: header ausente/nulo → es (fail-safe, ex.: ambiente local)", () => {
  assert.equal(idiomaPorPaisIp(""), "es");
  assert.equal(idiomaPorPaisIp(null), "es");
  assert.equal(idiomaPorPaisIp(undefined), "es");
});

test("authDomainMp: domínio de autorização correto por país", () => {
  assert.equal(authDomainMp("BR"), "auth.mercadopago.com.br");
  assert.equal(authDomainMp("AR"), "auth.mercadopago.com.ar");
  // Default seguro para valor inesperado.
  assert.equal(authDomainMp("xx"), "auth.mercadopago.com.ar");
});

test("precoAssinatura BR: valores em BRL definidos pelo cliente", () => {
  assert.equal(precoAssinatura("basico", "mensal", "BR"), 29.9);
  assert.equal(precoAssinatura("basico", "anual", "BR"), 299.0);
  assert.equal(precoAssinatura("pro", "mensal", "BR"), 38.89);
  assert.equal(precoAssinatura("pro", "anual", "BR"), 388.9);
});

test("precoAssinatura AR: valores em ARS preservados (sem regressão)", () => {
  assert.equal(precoAssinatura("basico", "mensal", "AR"), 11980);
  assert.equal(precoAssinatura("basico", "anual", "AR"), 119800);
  assert.equal(precoAssinatura("pro", "mensal", "AR"), 19850);
  assert.equal(precoAssinatura("pro", "anual", "AR"), 198500);
});

test("precoAssinatura: promoção anual = 10 mensalidades (2 meses grátis) nos 2 países", () => {
  for (const pais of ["AR", "BR"]) {
    for (const plano of ["basico", "pro"]) {
      const mensal = precoAssinatura(plano, "mensal", pais);
      const anual = precoAssinatura(plano, "anual", pais);
      // Tolerância de centavos para evitar ruído de ponto flutuante.
      assert.ok(
        Math.abs(anual - mensal * 10) < 0.01,
        `${plano}/${pais}: anual (${anual}) deveria ser 10× mensal (${mensal})`,
      );
    }
  }
});

test("precoAssinatura: país ausente usa AR (default) e plano desconhecido → null", () => {
  assert.equal(precoAssinatura("basico", "mensal"), 11980);
  assert.equal(precoAssinatura("inexistente", "mensal", "BR"), null);
});

test("PRECOS_ASSINATURA: cobre os dois planos nos dois países", () => {
  for (const plano of ["basico", "pro"]) {
    assert.ok(PRECOS_ASSINATURA[plano].AR, `${plano} precisa de preço AR`);
    assert.ok(PRECOS_ASSINATURA[plano].BR, `${plano} precisa de preço BR`);
  }
});

// ---------------------------------------------------------------------------
// Templates premium — matemática de cor, gating por plano e paletas
// (lib/templates-core.js)
// ---------------------------------------------------------------------------
import {
  normalizarHex,
  misturar,
  elevar,
  contraste,
  luminancia,
  ehEscuro,
  melhorContraste,
  garantirContraste,
  isTemplateId,
  planoDoTemplate,
  podeUsarTemplate,
  templatesDisponiveis,
  resolverTemplate,
  paletaEfetiva,
  derivarTema,
  TEMPLATES_MAX,
  TEMPLATE_PADRAO,
} from "./lib/templates-core.js";

// --- normalizarHex ---------------------------------------------------------
test("normalizarHex aceita hex de 6 digitos e minuscula", () => {
  assert.equal(normalizarHex("#AABBCC"), "#aabbcc");
});

test("normalizarHex expande a forma curta de 3 digitos", () => {
  assert.equal(normalizarHex("#abc"), "#aabbcc");
});

test("normalizarHex devolve o padrao para lixo", () => {
  assert.equal(normalizarHex("nao-e-cor", "#000000"), "#000000");
  assert.equal(normalizarHex(null), null);
  assert.equal(normalizarHex(undefined, "#123456"), "#123456");
});

// --- misturar / elevar -----------------------------------------------------
test("misturar a 0% devolve a base e a 100% devolve o alvo", () => {
  assert.equal(misturar("#000000", "#ffffff", 0), "#000000");
  assert.equal(misturar("#000000", "#ffffff", 100), "#ffffff");
});

test("misturar a 50% preto->branco da cinza medio", () => {
  assert.equal(misturar("#000000", "#ffffff", 50), "#808080");
});

test("misturar prende porcentagens fora da faixa", () => {
  assert.equal(misturar("#000000", "#ffffff", 200), "#ffffff");
  assert.equal(misturar("#000000", "#ffffff", -50), "#000000");
});

test("elevar preserva a matiz ao clarear (nao lava para branco)", () => {
  // O dourado de referencia sobe para a variante clara exata do design.
  assert.equal(elevar("#c8a96e", 12.5, 21), "#e8c98e");
});

test("elevar com delta negativo escurece", () => {
  assert.ok(luminancia(elevar("#808080", -20)) < luminancia("#808080"));
});

// --- contraste / luminancia ------------------------------------------------
test("contraste preto x branco e o maximo (21:1)", () => {
  assert.equal(Math.round(contraste("#000000", "#ffffff")), 21);
});

test("contraste e simetrico", () => {
  assert.equal(
    contraste("#0d0d0d", "#f0ede8").toFixed(4),
    contraste("#f0ede8", "#0d0d0d").toFixed(4),
  );
});

test("ehEscuro classifica fundos escuros e claros", () => {
  assert.equal(ehEscuro("#0d0d0d"), true);
  assert.equal(ehEscuro("#f6f4ef"), false);
});

test("melhorContraste escolhe o candidato mais legivel sobre o fundo", () => {
  assert.equal(melhorContraste("#ffb454", ["#0a0e14", "#dbe6ef"]), "#0a0e14");
  assert.equal(melhorContraste("#7a2138", ["#0d0d0d", "#f0ede8"]), "#f0ede8");
});

// --- garantirContraste (a trava de legibilidade) ---------------------------
test("garantirContraste mantem a cor quando ja passa", () => {
  assert.equal(garantirContraste("#f0ede8", "#0d0d0d", 4.5), "#f0ede8");
});

test("garantirContraste clareia um vinho quase-preto sobre fundo escuro", () => {
  const ajustada = garantirContraste("#1a0508", "#161616", 4.5);
  assert.ok(
    contraste(ajustada, "#161616") >= 4.5,
    "deveria atingir o piso de 4.5:1",
  );
});

test("garantirContraste escurece sobre fundo claro (mao inversa)", () => {
  const ajustada = garantirContraste("#f0f0f0", "#f6f4ef", 4.5);
  assert.ok(contraste(ajustada, "#f6f4ef") >= 4.5);
  assert.ok(luminancia(ajustada) < luminancia("#f0f0f0"));
});

// --- catalogo e gating -----------------------------------------------------
test("isTemplateId reconhece livres e premium, rejeita desconhecido", () => {
  assert.equal(isTemplateId("classico"), true);
  assert.equal(isTemplateId("atelier_noir"), true);
  assert.equal(isTemplateId("inexistente"), false);
  assert.equal(isTemplateId(null), false);
});

test("planoDoTemplate: livres nao exigem plano, premium exigem max", () => {
  assert.equal(planoDoTemplate("classico"), null);
  assert.equal(planoDoTemplate("moderno"), null);
  assert.equal(planoDoTemplate("atelier_noir"), "max");
  assert.equal(planoDoTemplate("blueprint_tecnico"), "max");
  assert.equal(planoDoTemplate("swiss_studio"), "max");
});

test("podeUsarTemplate: todos veem os livres", () => {
  for (const plano of ["basico", "pro", "max", "manual", null, undefined]) {
    assert.equal(podeUsarTemplate(plano, "classico"), true);
  }
});

test("podeUsarTemplate: so o plano max libera os premium", () => {
  for (const id of TEMPLATES_MAX) {
    assert.equal(podeUsarTemplate("max", id), true);
    assert.equal(podeUsarTemplate("pro", id), false);
    assert.equal(podeUsarTemplate("basico", id), false);
    assert.equal(podeUsarTemplate("manual", id), false);
    assert.equal(podeUsarTemplate(null, id), false);
  }
});

test("podeUsarTemplate nega template desconhecido para qualquer plano", () => {
  assert.equal(podeUsarTemplate("max", "inexistente"), false);
});

test("templatesDisponiveis: nao-max ve 3, max ve 6", () => {
  assert.equal(templatesDisponiveis("pro").length, 3);
  assert.equal(templatesDisponiveis("max").length, 6);
  assert.equal(templatesDisponiveis(null).length, 3);
});

test("resolverTemplate: max mantem o premium; nao-max cai no padrao", () => {
  assert.equal(resolverTemplate("max", "atelier_noir"), "atelier_noir");
  assert.equal(resolverTemplate("pro", "atelier_noir"), TEMPLATE_PADRAO);
  assert.equal(resolverTemplate(null, "swiss_studio"), TEMPLATE_PADRAO);
  // Downgrade nao vaza layout pago:
  assert.equal(resolverTemplate("basico", "blueprint_tecnico"), "classico");
  // Id invalido nunca renderiza:
  assert.equal(resolverTemplate("max", "lixo"), TEMPLATE_PADRAO);
});

// --- paletas ---------------------------------------------------------------
test("paletaEfetiva sem overrides devolve a paleta padrao", () => {
  const p = paletaEfetiva("atelier_noir", null);
  assert.equal(p.dourado, "#c8a96e");
  assert.equal(p.vinho, "#7a2138");
});

test("paletaEfetiva aplica so os overrides validos do tenant", () => {
  const p = paletaEfetiva("atelier_noir", {
    atelier_noir: { dourado: "#d4b57a", vinho: "cor-invalida" },
  });
  assert.equal(p.dourado, "#d4b57a"); // valido aplicado
  assert.equal(p.vinho, "#7a2138"); // invalido cai no padrao
});

test("paletaEfetiva ignora jsonb malformado sem lancar", () => {
  assert.equal(paletaEfetiva("atelier_noir", "nao-e-objeto").dourado, "#c8a96e");
  assert.equal(paletaEfetiva("atelier_noir", [1, 2, 3]).dourado, "#c8a96e");
  assert.equal(paletaEfetiva("inexistente", null), null);
});

// --- derivarTema: contraste garantido em toda a paleta ---------------------
test("derivarTema produz superficies de referencia a partir dos fundos", () => {
  assert.equal(derivarTema("atelier_noir", null).superficie, "#161616");
  assert.equal(derivarTema("blueprint_tecnico", null).superficie, "#101620");
});

test("derivarTema: texto e acento sempre passam o piso de contraste", () => {
  for (const id of TEMPLATES_MAX) {
    const t = derivarTema(id, null);
    assert.ok(
      contraste(t.texto, t.superficie) >= 7,
      `${id}: texto principal deve ter ao menos 7:1`,
    );
    assert.ok(
      contraste(t.textoSuave, t.superficie) >= 4.5,
      `${id}: texto suave deve ter ao menos 4.5:1`,
    );
    assert.ok(
      contraste(t.sobreAcento, t.acento) >= 4.5,
      `${id}: texto sobre o acento deve ter ao menos 4.5:1`,
    );
  }
});

test("derivarTema mantem contraste mesmo com cor hostil do usuario", () => {
  // Usuario escolhe um dourado escurissimo -- o texto do acento se ajusta.
  const t = derivarTema("atelier_noir", {
    atelier_noir: { dourado: "#2b2410" },
  });
  assert.ok(contraste(t.acentoTexto, t.superficie) >= 4.5);
});

test("derivarTema devolve null para template sem paleta", () => {
  assert.equal(derivarTema("classico", null), null);
  assert.equal(derivarTema("moderno", null), null);
});
