import { NextResponse } from "next/server";
import {
  getMpRedirectUri,
  trocarCodigoMpPorToken,
  buscarEmailContaMp,
} from "@/lib/mercadopago";
import { createServiceSupabase } from "@/lib/supabase-service";
import {
  aplicarRateLimit,
  limiterOauth,
  getClientIp,
  tooManyRequests,
} from "@/lib/rate-limit";

/**
 * /api/mp/oauth — conexão da conta Mercado Pago do PRESTADOR (OAuth).
 *
 * Recebe o `code` de autorização do Mercado Pago, troca pelo access_token da
 * conta do prestador e salva no tenant identificado por `state` (= tenant_id).
 * A partir daí o tenant recebe os pagamentos dos clientes finais na sua conta.
 *
 * `state` correlaciona o retorno ao tenant que iniciou a conexão. A persistência
 * usa a SERVICE ROLE (não depende de sessão), então a rota funciona tanto via
 * chamada server-side da página de configurações (POST) quanto como redirect_uri
 * direto (GET) em ambientes sem o reenvio do middleware.
 *
 * Rota pública (prefixo /api/mp) — não envolve dados de outros tenants: o code
 * só é válido para a conta que autorizou, e o state aponta o tenant de destino.
 */

async function conectar(code: string, state: string) {
  const tenantId = state.trim();
  if (!code || !tenantId) {
    return { ok: false as const, status: 400, erro: "code/state ausentes." };
  }

  // 1. Troca o código pelo access_token da conta do prestador.
  const token = await trocarCodigoMpPorToken(code, getMpRedirectUri());

  // 2. Descobre o e-mail da conta conectada (best-effort, só para exibição).
  const email = await buscarEmailContaMp(token.access_token);

  // 3. Salva no tenant (service role — ignora RLS).
  const supabase = createServiceSupabase();
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

  let body: { code?: string; state?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  try {
    const r = await conectar(body.code ?? "", body.state ?? "");
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

/** GET — suporte a redirect_uri direto. Após conectar, volta às configurações. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code") ?? "";
  const state = searchParams.get("state") ?? "";
  const destino = `${getMpRedirectUri()}`;

  // Rate limit: em excesso, redireciona com mp=erro (preserva a UX do callback
  // em vez de devolver um 429 cru no meio do fluxo de conexão).
  const rl = await aplicarRateLimit(limiterOauth, `oauth:${getClientIp(req)}`);
  if (!rl.ok) {
    const url = new URL(destino);
    url.searchParams.set("mp", "erro");
    return NextResponse.redirect(url);
  }

  try {
    const r = await conectar(code, state);
    const url = new URL(destino);
    url.searchParams.set("mp", r.ok ? "ok" : "erro");
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("[mp/oauth][GET] erro:", err);
    const url = new URL(destino);
    url.searchParams.set("mp", "erro");
    return NextResponse.redirect(url);
  }
}
