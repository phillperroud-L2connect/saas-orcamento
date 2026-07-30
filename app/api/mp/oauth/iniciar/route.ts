import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import {
  getMpRedirectUri,
  getMpOAuthStateSecret,
  buildMpAuthorizationUrl,
} from "@/lib/mercadopago";
import { normalizarPais } from "@/lib/mp-paises";
import { gerarNonce, assinarState } from "@/lib/mp-oauth-state";
import {
  aplicarRateLimit,
  limiterOauth,
  getClientIp,
  tooManyRequests,
} from "@/lib/rate-limit";

/**
 * POST /api/mp/oauth/iniciar
 *
 * Inicia a conexão OAuth do Mercado Pago de forma SEGURA. Roda com a sessão do
 * prestador (rota protegida pelo middleware) e:
 *   1. resolve o tenant do usuário LOGADO (nunca confia num id vindo do client);
 *   2. gera um nonce e assina um `state` (HMAC) que amarra tenant + nonce + iat;
 *   3. grava o nonce num cookie httpOnly de vida curta (casado no callback → CSRF);
 *   4. devolve a URL de autorização do MP já montada (gaveta AR/BR do tenant).
 *
 * Substitui o antigo `state = tenant_id` cru montado no browser: agora o state é
 * inforjável (sem o segredo) e de uso único ligado à sessão.
 *
 * Fail-closed: sem MP_OAUTH_STATE_SECRET, responde 503 e a conexão não acontece.
 */

/** Cookie do nonce anti-CSRF (casado com o `state` no callback). */
const COOKIE_NONCE = "mp_oauth_nonce";
/** Escopo do cookie: só a página de callback precisa lê-lo. */
const COOKIE_PATH = "/dashboard/configuracoes";
/** Vida curta: mesma janela do state (10 min). */
const COOKIE_MAX_AGE_S = 600;

export async function POST(req: Request) {
  const rl = await aplicarRateLimit(limiterOauth, `oauth-iniciar:${getClientIp(req)}`);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  // Fail-closed: sem segredo configurado, a conexão fica desabilitada.
  let secret: string;
  try {
    secret = getMpOAuthStateSecret();
  } catch (err) {
    console.error("[mp/oauth/iniciar] segredo ausente (fail-closed):", err);
    return NextResponse.json({ erro: "mp_oauth_indisponivel" }, { status: 503 });
  }

  // Sessão obrigatória: o tenant vem SEMPRE do usuário logado.
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  const tenantId = (userRow?.tenant_id as string | undefined) ?? "";
  if (!tenantId) {
    return NextResponse.json({ erro: "sem_tenant" }, { status: 400 });
  }

  // País do tenant → gaveta OAuth (aplicação/domínio AR ou BR).
  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("pais")
    .eq("id", tenantId)
    .maybeSingle();
  const pais = normalizarPais(tenantRow?.pais);

  const nonce = gerarNonce();
  const state = assinarState({ tenantId, nonce }, secret);

  let url: string;
  try {
    url = buildMpAuthorizationUrl(state, getMpRedirectUri(), pais);
  } catch (err) {
    // client_id da gaveta do país não configurado.
    console.error("[mp/oauth/iniciar] falha ao montar URL de autorização:", err);
    return NextResponse.json({ erro: "mp_oauth_indisponivel" }, { status: 503 });
  }

  const resp = NextResponse.json({ url });
  resp.cookies.set(COOKIE_NONCE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // sobrevive ao redirect top-level de volta do Mercado Pago
    path: COOKIE_PATH,
    maxAge: COOKIE_MAX_AGE_S,
  });
  return resp;
}
