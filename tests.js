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
