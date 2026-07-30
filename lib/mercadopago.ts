import { MercadoPagoConfig } from "mercadopago";
import crypto from "node:crypto";
import type { Pais } from "./types";
import { normalizarPais, authDomainMp } from "./mp-paises";

/* ===========================================================================
 * Validação da assinatura do webhook (x-signature)
 * ======================================================================== */

export type ResultadoAssinatura = { ok: boolean; motivo?: string };

/**
 * Verifica a autenticidade de uma notificação do Mercado Pago.
 *
 * O MP assina cada webhook e envia no header `x-signature` o par `ts` e `v1`:
 *     x-signature: ts=1700000000,v1=<hmac-sha256-hex>
 * mais o header `x-request-id`. O valor `v1` é o HMAC-SHA256 do "manifest"
 *     id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 * usando como chave a SECRET do webhook (Mercado Pago → Suas integrações →
 * (sua app) → Webhooks → "Assinatura secreta"), em MP_WEBHOOK_SECRET.
 *
 * Fail-closed: sem secret configurada ou sem assinatura válida → { ok: false }.
 * (A rota responde 401.) Comparação timing-safe contra timing attacks.
 *
 * @param req     Requisição recebida (lê os headers x-signature / x-request-id).
 * @param dataId  O `data.id` do recurso (vem da query `data.id`/`id` ou do corpo).
 */
export function verificarAssinaturaMpWebhook(
  req: Request,
  dataId: string | null,
  pais: Pais = "AR",
): ResultadoAssinatura {
  // Cada aplicação (AR/BR) assina seus webhooks com a própria "Assinatura
  // secreta". Escolhe a gaveta conforme o país; default "AR" preserva o legado.
  const secret =
    normalizarPais(pais) === "BR"
      ? process.env.MP_WEBHOOK_SECRET_BR
      : process.env.MP_WEBHOOK_SECRET;
  if (!secret) return { ok: false, motivo: "secret_ausente" };

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id") ?? "";
  if (!xSignature) return { ok: false, motivo: "assinatura_ausente" };

  // x-signature = "ts=...,v1=..."
  let ts: string | undefined;
  let v1: string | undefined;
  for (const parte of xSignature.split(",")) {
    const [chave, valor] = parte.split("=").map((s) => s?.trim());
    if (chave === "ts") ts = valor;
    else if (chave === "v1") v1 = valor;
  }
  if (!ts || !v1) return { ok: false, motivo: "assinatura_malformada" };

  // Regra do MP: se data.id for alfanumérico, normaliza para minúsculas.
  const id = (dataId ?? "").toLowerCase();

  const manifest = `id:${id};request-id:${xRequestId};ts:${ts};`;
  const esperado = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(v1, "utf8");
  const valido = a.length === b.length && crypto.timingSafeEqual(a, b);

  return valido ? { ok: true } : { ok: false, motivo: "assinatura_invalida" };
}

/**
 * Configuração do SDK do Mercado Pago da conta do DONO do SaaS (recebe as
 * assinaturas), escolhendo a "gaveta" de credenciais conforme o país:
 *   - AR → MP_ACCESS_TOKEN           (conta/aplicação Argentina)
 *   - BR → MP_ACCESS_TOKEN_BR        (conta/aplicação Brasil)
 *
 * `pais` default "AR" preserva o comportamento dos chamadores legados. A public
 * key (NEXT_PUBLIC_MP_PUBLIC_KEY[_BR]) é usada só no browser (Wallet Brick).
 */
export function getMercadoPagoClient(pais: Pais = "AR"): MercadoPagoConfig {
  const p = normalizarPais(pais);
  const accessToken =
    p === "BR" ? process.env.MP_ACCESS_TOKEN_BR : process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    const varNome = p === "BR" ? "MP_ACCESS_TOKEN_BR" : "MP_ACCESS_TOKEN";
    throw new Error(`${varNome} não definido no .env.local.`);
  }
  return new MercadoPagoConfig({
    accessToken,
    options: { timeout: 8000 },
  });
}

/**
 * Cliente do SDK para um access_token ARBITRÁRIO (a conta MP de um prestador
 * conectada via OAuth). Usado para criar cobranças que caem na conta do
 * prestador — não na conta do dono do SaaS.
 */
export function getMercadoPagoClientFor(accessToken: string): MercadoPagoConfig {
  return new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } });
}

/* ===========================================================================
 * OAuth do Mercado Pago — conexão da conta do PRESTADOR (Marketplace / Connect)
 * ======================================================================== */

/**
 * redirect_uri do OAuth — precisa ser idêntico no botão de autorização e na
 * troca do código (o Mercado Pago valida a igualdade exata).
 *
 * Aponta para a PÁGINA protegida de configurações (não para /api/mp/oauth):
 * o middleware reenvia usuários logados que caem em rotas públicas (/api/mp)
 * de volta ao /dashboard, descartando a query. A página recebe ?code/&state e
 * delega a troca à rota /api/mp/oauth via chamada server-side (sem cookies).
 *
 * Registre EXATAMENTE esta URL nas "URLs de redirecionamento" da sua app no MP.
 */
export function getMpRedirectUri(): string {
  return `${getSiteUrl()}/dashboard/configuracoes`;
}

/**
 * Segredo do HMAC que assina o `state` do OAuth (CSRF/anti-forja).
 *
 * FAIL-CLOSED (decisão de segurança): se MP_OAUTH_STATE_SECRET estiver ausente
 * ou for curto demais, LANÇA — a conexão do Mercado Pago fica desabilitada com
 * erro claro, em vez de cair no comportamento inseguro (state = tenant_id cru).
 * Gere um valor aleatório de 32+ bytes e defina no .env.local e na Vercel.
 */
export function getMpOAuthStateSecret(): string {
  const secret = process.env.MP_OAUTH_STATE_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "MP_OAUTH_STATE_SECRET ausente ou curto: conexão do Mercado Pago desabilitada (fail-closed). Defina um segredo aleatório de 32+ bytes no .env.local e na Vercel.",
    );
  }
  return secret;
}

/**
 * Credenciais da aplicação OAuth (client_id público + client_secret server-side),
 * escolhendo a gaveta conforme o país:
 *   - AR → NEXT_PUBLIC_MP_CLIENT_ID  / MP_CLIENT_SECRET     (aplicação Argentina)
 *   - BR → NEXT_PUBLIC_MP_CLIENT_ID_BR / MP_CLIENT_SECRET_BR (aplicação Brasil)
 */
export function getMpOAuthCredentials(pais: Pais = "AR"): {
  clientId: string;
  clientSecret: string;
} {
  const p = normalizarPais(pais);
  const clientId =
    p === "BR"
      ? process.env.NEXT_PUBLIC_MP_CLIENT_ID_BR
      : process.env.NEXT_PUBLIC_MP_CLIENT_ID;
  const clientSecret =
    p === "BR" ? process.env.MP_CLIENT_SECRET_BR : process.env.MP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const sufixo = p === "BR" ? "_BR" : "";
    throw new Error(
      `OAuth do Mercado Pago (${p}) indisponível: defina NEXT_PUBLIC_MP_CLIENT_ID${sufixo} e MP_CLIENT_SECRET${sufixo} no .env.local.`,
    );
  }
  return { clientId, clientSecret };
}

/**
 * Monta a URL de autorização do Mercado Pago para o país informado (domínio
 * .com.ar ou .com.br + client_id da aplicação correspondente). O `state`
 * correlaciona o retorno ao tenant que iniciou a conexão. Server-side (usa a
 * gaveta correta); o botão no client monta a URL equivalente com a public var.
 */
export function buildMpAuthorizationUrl(
  state: string,
  redirectUri: string,
  pais: Pais = "AR",
): string {
  const p = normalizarPais(pais);
  const clientId =
    p === "BR"
      ? process.env.NEXT_PUBLIC_MP_CLIENT_ID_BR
      : process.env.NEXT_PUBLIC_MP_CLIENT_ID;
  if (!clientId) {
    const sufixo = p === "BR" ? "_BR" : "";
    throw new Error(`NEXT_PUBLIC_MP_CLIENT_ID${sufixo} não definido no .env.local.`);
  }
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    platform_id: "mp",
    state,
    redirect_uri: redirectUri,
  });
  return `https://${authDomainMp(p)}/authorization?${params.toString()}`;
}

/** Resposta do endpoint de token OAuth do Mercado Pago. */
export type MpOAuthToken = {
  access_token: string;
  refresh_token?: string;
  user_id?: number | string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

/**
 * Troca o `code` de autorização pelo access_token da conta do prestador.
 * Roda apenas no servidor (usa o client_secret).
 */
export async function trocarCodigoMpPorToken(
  code: string,
  redirectUri: string,
  pais: Pais = "AR",
): Promise<MpOAuthToken> {
  const { clientId, clientSecret } = getMpOAuthCredentials(pais);

  const res = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    throw new Error(`Falha na troca do código OAuth (${res.status}): ${detalhe}`);
  }
  return (await res.json()) as MpOAuthToken;
}

/**
 * Renova o access_token do prestador a partir do refresh_token
 * (`grant_type=refresh_token`). O Mercado Pago ROTACIONA os tokens: além de um
 * novo access_token, devolve um novo refresh_token que substitui o anterior — o
 * chamador precisa persistir AMBOS. Usa a gaveta de credenciais do país (a mesma
 * aplicação AR/BR que emitiu o token original). Roda só no servidor (client_secret).
 */
export async function renovarTokenMp(
  refreshToken: string,
  pais: Pais = "AR",
): Promise<MpOAuthToken> {
  const { clientId, clientSecret } = getMpOAuthCredentials(pais);

  const res = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    // Não incluímos o corpo da resposta na mensagem para não arriscar registrar
    // credenciais/token em log; o `status` é suficiente para diagnosticar.
    throw new Error(`Falha ao renovar token OAuth do Mercado Pago (${res.status}).`);
  }
  return (await res.json()) as MpOAuthToken;
}

/**
 * true quando o erro lançado pelo SDK do Mercado Pago indica token
 * expirado/revogado (HTTP 401/403). O SDK lança o corpo de erro da API, que
 * carrega um `status` numérico (ver node_modules/mercadopago/dist/utils/restClient).
 * É o gatilho da renovação automática de token.
 */
export function ehErro401Mp(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status = (err as { status?: unknown }).status;
  return status === 401 || status === 403;
}

/**
 * Executa uma operação na API do Mercado Pago com o access_token do prestador e,
 * se ela falhar por token expirado/revogado (401/403), renova o token via
 * refresh_token (o MP rotaciona: novo access + novo refresh), persiste os novos
 * tokens pelo callback `onRenovado` e REPETE a operação uma única vez. Assim uma
 * conexão só "expira de vez" se o próprio refresh também falhar.
 *
 * Genérico e sem acoplamento a banco: quem chama decide como persistir. Sem
 * refresh_token, ou se a renovação falhar, o erro ORIGINAL (401) é propagado —
 * o comportamento atual de erro é preservado quando não há como renovar.
 */
export async function executarComRenovacaoMp<T>(params: {
  accessToken: string;
  refreshToken?: string | null;
  pais?: Pais;
  run: (accessToken: string) => Promise<T>;
  onRenovado: (token: MpOAuthToken) => Promise<void> | void;
}): Promise<T> {
  const { accessToken, refreshToken, pais = "AR", run, onRenovado } = params;
  try {
    return await run(accessToken);
  } catch (err) {
    if (!ehErro401Mp(err) || !refreshToken) throw err;

    let novo: MpOAuthToken;
    try {
      novo = await renovarTokenMp(refreshToken, pais);
    } catch (renewErr) {
      console.error(
        "[mp] renovação automática de token falhou:",
        renewErr instanceof Error ? renewErr.message : String(renewErr),
      );
      throw err; // mantém o 401 original como erro definitivo
    }

    await onRenovado(novo);
    return await run(novo.access_token);
  }
}

/** Busca o e-mail da conta MP conectada (best-effort — null se indisponível). */
export async function buscarEmailContaMp(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    return data.email ?? null;
  } catch {
    return null;
  }
}

/**
 * URL base pública da aplicação, usada para montar back_urls e o link de
 * notificação (webhook) do Mercado Pago. Em produção defina NEXT_PUBLIC_SITE_URL.
 */
export function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  );
}
