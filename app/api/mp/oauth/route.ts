import { NextResponse } from "next/server";
import {
  getMpRedirectUri,
  getMpOAuthStateSecret,
  trocarCodigoMpPorToken,
  buscarEmailContaMp,
} from "@/lib/mercadopago";
import { createServiceSupabase } from "@/lib/supabase-service";
import { normalizarPais } from "@/lib/mp-paises";
import { verificarState } from "@/lib/mp-oauth-state";
import {
  aplicarRateLimit,
  limiterOauth,
  getClientIp,
  tooManyRequests,
} from "@/lib/rate-limit";

/**
 * POST /api/mp/oauth — troca do `code` do OAuth pelos tokens do PRESTADOR.
 *
 * O `state` é um token ASSINADO (HMAC) emitido por /api/mp/oauth/iniciar; o
 * tenant de destino vem do payload verificado — nunca de um id cru do chamador.
 * Sem o segredo do servidor não há como forjar um state para outro tenant, então
 * mesmo sendo chamada pública (prefixo /api/mp) a rota não redireciona tokens.
 *
 * A ligação com a sessão + nonce (anti-CSRF) é conferida na página de callback
 * (rota protegida) ANTES de chamar esta rota; aqui reforçamos a integridade do
 * state (defesa em profundidade).
 *
 * Fail-closed: sem MP_OAUTH_STATE_SECRET, responde 503 e nada é gravado.
 *
 * (O antigo fallback GET público foi removido: o redirect_uri é a página
 * protegida de configurações, então o GET nunca era usado no fluxo normal.)
 */

async function conectar(code: string, tenantId: string) {
  const supabase = createServiceSupabase();

  // 0. País do tenant → gaveta OAuth (client_secret AR ou BR) usada na troca.
  //    Default "AR" preserva o fluxo legado se a coluna vier nula.
  const { data: tenantPais } = await supabase
    .from("tenants")
    .select("pais")
    .eq("id", tenantId)
    .maybeSingle();
  const pais = normalizarPais(tenantPais?.pais);

  // 1. Troca o código pelo access_token da conta do prestador (gaveta do país).
  const token = await trocarCodigoMpPorToken(code, getMpRedirectUri(), pais);

  // 2. Descobre o e-mail da conta conectada (best-effort, só para exibição).
  const email = await buscarEmailContaMp(token.access_token);

  // 3. Salva no tenant (service role — ignora RLS).
  const { error } = await supabase
    .from("tenants")
    .update({
      mp_access_token: token.access_token,
      mp_user_id: token.user_id != null ? String(token.user_id) : null,
      mp_refresh_token: token.refresh_token ?? null,
      mp_email: email,
    })
    .eq("id", tenantId);

  if (error) {
    console.error("[mp/oauth] erro ao salvar token no tenant:", error);
    return { ok: false as const, status: 500, erro: "Falha ao salvar a conexão." };
  }

  return { ok: true as const, email };
}

/** POST — chamado server-side pela página de configurações. Body: {code,state}. */
export async function POST(req: Request) {
  const rl = await aplicarRateLimit(limiterOauth, `oauth:${getClientIp(req)}`);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  // Fail-closed: sem segredo, não há como validar o state → não conecta.
  let secret: string;
  try {
    secret = getMpOAuthStateSecret();
  } catch (err) {
    console.error("[mp/oauth] segredo ausente (fail-closed):", err);
    return NextResponse.json({ erro: "mp_oauth_indisponivel" }, { status: 503 });
  }

  let body: { code?: string; state?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const code = (body.code ?? "").trim();
  if (!code) {
    return NextResponse.json({ erro: "code ausente." }, { status: 400 });
  }

  // Integridade do state: assinatura + expiração. O tenant vem do payload.
  const v = verificarState(body.state, secret);
  if (!v.ok) {
    console.warn("[mp/oauth] state rejeitado:", v.motivo);
    return NextResponse.json({ erro: "state_invalido" }, { status: 400 });
  }

  try {
    const r = await conectar(code, v.tenantId);
    if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: r.status });
    return NextResponse.json({ ok: true, email: r.email });
  } catch (err) {
    console.error("[mp/oauth][POST] erro:", err);
    return NextResponse.json(
      { erro: "Não foi possível conectar o Mercado Pago." },
      { status: 502 },
    );
  }
}
