// Núcleo PURO da assinatura do `state` do OAuth do Mercado Pago (CSRF/anti-forja).
//
// Em .js (ESM) para ser testável em Node puro (tests.js) e reutilizável pelos
// route handlers/página server-side. Sem I/O e sem env: o segredo vem SEMPRE por
// parâmetro (quem chama lê MP_OAUTH_STATE_SECRET e decide o fail-closed). Nunca
// lança na verificação — devolve { ok:false, motivo } para o chamador tratar.
//
// Formato do token (compacto, URL-safe, cabe no ?state= do MP):
//     base64url(payloadJSON) + "." + base64url(HMAC_SHA256(secret, payloadB64))
//     payloadJSON = {"t":<tenant_id>,"n":<nonce>,"iat":<epoch_segundos>}
//
// `t`  amarra o token a um tenant (conferido contra a sessão no callback);
// `n`  é o nonce de uso único casado com o cookie httpOnly (anti-CSRF);
// `iat`dá expiração curta (replay bounded), verificada em verificarState.

import crypto from "node:crypto";

const SEP = ".";
/** Validade padrão do state: 10 min (janela generosa p/ o usuário autorizar). */
const MAX_IDADE_PADRAO_S = 600;
/** Tolerância de relógio para o iat (evita rejeitar por skew de poucos segundos). */
const SKEW_S = 30;

function b64urlEncode(str) {
  return Buffer.from(str, "utf8").toString("base64url");
}

function b64urlDecodeToString(b64) {
  return Buffer.from(String(b64), "base64url").toString("utf8");
}

/** Nonce aleatório (192 bits) URL-safe para o par state/cookie anti-CSRF. */
export function gerarNonce() {
  return crypto.randomBytes(24).toString("base64url");
}

/**
 * Assina o state. Lança se faltar segredo/tenant/nonce (erro de programação do
 * chamador — o fail-closed do segredo é responsabilidade de quem lê o env).
 *
 * @param {{ tenantId: string, nonce: string, iat?: number }} dados
 * @param {string} secret
 * @returns {string} token assinado
 */
export function assinarState(dados, secret) {
  if (!secret) throw new Error("assinarState: secret ausente.");
  const tenantId = dados && dados.tenantId != null ? String(dados.tenantId) : "";
  const nonce = dados && dados.nonce != null ? String(dados.nonce) : "";
  if (!tenantId || !nonce) {
    throw new Error("assinarState: tenantId/nonce ausentes.");
  }
  const iat =
    dados && Number.isFinite(dados.iat)
      ? Math.floor(dados.iat)
      : Math.floor(Date.now() / 1000);

  const payloadB64 = b64urlEncode(JSON.stringify({ t: tenantId, n: nonce, iat }));
  const sig = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}${SEP}${sig}`;
}

/**
 * Verifica assinatura + expiração e devolve os campos. Nunca lança.
 *
 * @param {unknown} token
 * @param {string | undefined | null} secret
 * @param {{ maxIdadeSegundos?: number, agoraMs?: number }} [opcoes]
 * @returns {{ ok: true, tenantId: string, nonce: string, iat: number }
 *   | { ok: false, motivo: string }}
 */
export function verificarState(token, secret, opcoes) {
  const maxIdade =
    opcoes && Number.isFinite(opcoes.maxIdadeSegundos)
      ? opcoes.maxIdadeSegundos
      : MAX_IDADE_PADRAO_S;
  const agoraMs =
    opcoes && Number.isFinite(opcoes.agoraMs) ? opcoes.agoraMs : Date.now();

  if (!secret) return { ok: false, motivo: "secret_ausente" };
  if (typeof token !== "string" || !token.includes(SEP)) {
    return { ok: false, motivo: "malformado" };
  }

  const idx = token.indexOf(SEP);
  const payloadB64 = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (!payloadB64 || !sig) return { ok: false, motivo: "malformado" };

  // Timing-safe: compara o HMAC recalculado com o recebido.
  const esperado = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");
  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(sig, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, motivo: "assinatura_invalida" };
  }

  let dados;
  try {
    dados = JSON.parse(b64urlDecodeToString(payloadB64));
  } catch {
    return { ok: false, motivo: "payload_invalido" };
  }

  const tenantId = typeof dados.t === "string" ? dados.t : "";
  const nonce = typeof dados.n === "string" ? dados.n : "";
  const iat = Number(dados.iat);
  if (!tenantId || !nonce || !Number.isFinite(iat)) {
    return { ok: false, motivo: "payload_incompleto" };
  }

  const agoraS = Math.floor(agoraMs / 1000);
  if (iat > agoraS + SKEW_S) return { ok: false, motivo: "futuro" };
  if (iat < agoraS - maxIdade) return { ok: false, motivo: "expirado" };

  return { ok: true, tenantId, nonce, iat };
}
