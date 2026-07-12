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
