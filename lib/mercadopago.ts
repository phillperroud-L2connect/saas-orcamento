import { MercadoPagoConfig } from "mercadopago";

/**
 * Configuração do SDK do Mercado Pago (conta da Argentina).
 *
 * Usa o MP_ACCESS_TOKEN (privado, server-side). A NEXT_PUBLIC_MP_PUBLIC_KEY é
 * usada apenas no browser (Wallet Brick) e não entra aqui.
 */
export function getMercadoPagoClient(): MercadoPagoConfig {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MP_ACCESS_TOKEN não definido no .env.local.");
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

/** Credenciais da aplicação (client_id público + client_secret server-side). */
export function getMpOAuthCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.NEXT_PUBLIC_MP_CLIENT_ID;
  const clientSecret = process.env.MP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "OAuth do Mercado Pago indisponível: defina NEXT_PUBLIC_MP_CLIENT_ID e MP_CLIENT_SECRET no .env.local.",
    );
  }
  return { clientId, clientSecret };
}

/**
 * Monta a URL de autorização do Mercado Pago (Argentina). O `state` correlaciona
 * o retorno ao tenant que iniciou a conexão. Pode rodar no client (usa apenas o
 * client_id público + redirect_uri).
 */
export function buildMpAuthorizationUrl(state: string, redirectUri: string): string {
  const clientId = process.env.NEXT_PUBLIC_MP_CLIENT_ID;
  if (!clientId) {
    throw new Error("NEXT_PUBLIC_MP_CLIENT_ID não definido no .env.local.");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    platform_id: "mp",
    state,
    redirect_uri: redirectUri,
  });
  return `https://auth.mercadopago.com.ar/authorization?${params.toString()}`;
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
): Promise<MpOAuthToken> {
  const { clientId, clientSecret } = getMpOAuthCredentials();

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
