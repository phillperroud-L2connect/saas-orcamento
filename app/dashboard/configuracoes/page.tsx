import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ConfiguracoesForm } from "@/components/configuracoes-form";
import { createServerSupabase } from "@/lib/supabase-server";
import { getMpOAuthStateSecret } from "@/lib/mercadopago";
import { verificarState } from "@/lib/mp-oauth-state";

export const metadata = {
  title: "Configurações | Gerador de Orçamento",
};

/** Cookie do nonce anti-CSRF (setado por /api/mp/oauth/iniciar). */
const COOKIE_NONCE = "mp_oauth_nonce";

/**
 * Página de configurações do tenant.
 *
 * Também é o redirect_uri do OAuth do Mercado Pago: quando o prestador volta da
 * autorização, o MP acrescenta ?code=...&state=<state assinado>. Como esta rota
 * é protegida, a SESSÃO está disponível aqui — é onde amarramos o retorno à
 * sessão (anti-CSRF) antes de trocar o código:
 *
 *   1. resolve o tenant do usuário LOGADO;
 *   2. valida o `state` (HMAC + expiração) e confere `state.tenant === sessão`;
 *   3. casa o nonce do `state` com o cookie httpOnly (setado no início do fluxo);
 *   4. só então delega a troca a /api/mp/oauth (que revalida o HMAC).
 *
 * Qualquer divergência → ?mp=erro, sem tocar nos tokens. O cookie do nonce é de
 * vida curta (10 min) e se expira sozinho — um Server Component não pode apagar
 * cookies, e o `code` do MP é de uso único, então a janela de replay é limitada.
 */
export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: { code?: string; state?: string; mp?: string };
}) {
  const code = searchParams.code;
  const state = searchParams.state;

  if (code && state) {
    const destino = await processarCallbackMp(code, state);
    redirect(`/dashboard/configuracoes?mp=${destino}`);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ConfiguracoesForm />
    </main>
  );
}

/**
 * Valida o retorno do OAuth amarrado à sessão + nonce e, se tudo confere, delega
 * a troca do código a /api/mp/oauth. Retorna "ok" ou "erro" (nunca lança).
 */
async function processarCallbackMp(
  code: string,
  state: string,
): Promise<"ok" | "erro"> {
  // Fail-closed: sem segredo configurado, não valida nem conecta.
  let secret: string;
  try {
    secret = getMpOAuthStateSecret();
  } catch (err) {
    console.error("[configuracoes] segredo do state ausente (fail-closed):", err);
    return "erro";
  }

  // Tenant da SESSÃO (o middleware garante que há usuário nesta rota).
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "erro";

  const { data: userRow } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  const tenantSessao = (userRow?.tenant_id as string | undefined) ?? "";
  if (!tenantSessao) return "erro";

  // Integridade do state (assinatura + expiração).
  const v = verificarState(state, secret);
  if (!v.ok) {
    console.warn("[configuracoes] state rejeitado:", v.motivo);
    return "erro";
  }

  // Ligação com a sessão: o state tem que ser do tenant logado.
  if (v.tenantId !== tenantSessao) {
    console.warn("[configuracoes] state de outro tenant — recusado.");
    return "erro";
  }

  // Anti-CSRF: o nonce do state tem que casar com o cookie httpOnly.
  const nonceCookie = cookies().get(COOKIE_NONCE)?.value ?? "";
  if (!nonceCookie || nonceCookie !== v.nonce) {
    console.warn("[configuracoes] nonce ausente/divergente — recusado.");
    return "erro";
  }

  // Tudo confere: delega a troca (a rota revalida o HMAC do state).
  const h = headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  try {
    const res = await fetch(`${origin}/api/mp/oauth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state }),
      cache: "no-store",
    });
    return res.ok ? "ok" : "erro";
  } catch (err) {
    console.error("[configuracoes] erro ao trocar código MP:", err);
    return "erro";
  }
}
