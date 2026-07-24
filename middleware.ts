import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAdminUser } from "@/lib/admin";
import { idiomaPorPaisIp } from "@/lib/mp-paises";

// Cookie que lembra a última escolha de idioma do checkout (manual via ?lang=
// ou inferida pelo IP), para que navegações sem ?lang= a respeitem. 1 ano.
const COOKIE_IDIOMA = "pref_idioma";
const COOKIE_IDIOMA_MAX_AGE = 60 * 60 * 24 * 365;

/** "pt"/"es" se o valor for um idioma suportado explícito; senão null. */
function normalizarLangParam(
  valor: string | null | undefined,
): "pt" | "es" | null {
  const v = String(valor ?? "").trim().toLowerCase();
  return v === "pt" || v === "es" ? v : null;
}

/** Grava a preferência de idioma na resposta (cookie lax, 1 ano). */
function persistirIdioma(resp: NextResponse, lang: "pt" | "es") {
  resp.cookies.set(COOKIE_IDIOMA, lang, {
    path: "/",
    maxAge: COOKIE_IDIOMA_MAX_AGE,
    sameSite: "lax",
  });
}

/**
 * Checkout público de plano: define o idioma de PARTIDA (pt/BR ou es/AR) sem
 * NUNCA travar a escolha do visitante. Precedência:
 *   1. ?lang= explícito (link do site institucional OU troca manual) — vence
 *      sempre; apenas renderiza e memoriza a escolha no cookie.
 *   2. cookie de preferência (última escolha explícita anterior).
 *   3. país do IP via header `x-vercel-ip-country` (BR → pt; resto → es).
 * Nos casos 2 e 3 redireciona anexando o ?lang= para que o resto do sistema
 * (page/checkout, credenciais MP, moeda, textos) enxergue o idioma. Depois do
 * redirect o ?lang= vira explícito → cai no caso 1 → sem loop.
 *
 * À prova de falha: qualquer erro (ou ambiente sem o header, como local) segue
 * sem redirecionar (fail-open) — a venda nunca pode quebrar por causa disto.
 */
function tratarIdiomaCheckout(request: NextRequest): NextResponse {
  try {
    const url = request.nextUrl.clone();

    const explicito = normalizarLangParam(url.searchParams.get("lang"));
    if (explicito) {
      const resp = NextResponse.next({ request });
      persistirIdioma(resp, explicito);
      return resp;
    }

    const preferido = normalizarLangParam(
      request.cookies.get(COOKIE_IDIOMA)?.value,
    );
    const lang =
      preferido ?? idiomaPorPaisIp(request.headers.get("x-vercel-ip-country"));

    url.searchParams.set("lang", lang);
    const resp = NextResponse.redirect(url);
    persistirIdioma(resp, lang);
    return resp;
  } catch (err) {
    console.error("[middleware] idioma do checkout — fail-open:", err);
    return NextResponse.next({ request });
  }
}

// Rotas públicas — acessíveis sem autenticação.
// /checkout e /api/mp são públicas: a venda acontece antes de existir conta,
// e o webhook do Mercado Pago chega sem sessão de usuário.
const ROTAS_PUBLICAS = [
  "/login",
  "/cadastro",
  "/admin/login",
  // Recuperação de senha do admin (sem sessão; o reset ganha a sessão de
  // recuperação só após o verifyOtp do token do e-mail).
  "/admin/forgot-password",
  "/admin/reset-password",
  // Endpoint público que dispara o e-mail de recuperação do admin.
  "/api/admin/recuperar-senha",
  "/checkout",
  "/api/mp",
  // Login server-side (rate-limited) — chamado por quem ainda não tem sessão.
  "/api/auth",
  // Validação/criação de conta por token (onboarding pós-pagamento), sem sessão.
  "/api/cadastro",
  // Página pública de pagamento do orçamento (cliente final, sem conta).
  "/pagar",
  // Preview dos templates premium (só conteúdo fictício de demonstração) —
  // público para revisão visual por link, sem exigir login.
  "/preview-templates",
  // Recuperação de senha: forgot-password (sem sessão) e reset-password
  // (só ganha a sessão de recuperação após trocar o code do link do e-mail).
  "/auth",
];

export async function middleware(request: NextRequest) {
  // Checkout público de plano: idioma de partida por IP (sem travar a escolha).
  // Tratado antes da revalidação de sessão (rota pública, sem login). Exclui
  // /checkout/sucesso — o pós-pagamento não usa ?lang= e não deve redirecionar.
  const { pathname: caminho } = request.nextUrl;
  if (
    caminho.startsWith("/checkout/") &&
    !caminho.startsWith("/checkout/sucesso")
  ) {
    return tratarIdiomaCheckout(request);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: getUser() revalida a sessão e atualiza os cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const ehRotaPublica = ROTAS_PUBLICAS.some((rota) =>
    pathname.startsWith(rota),
  );

  // Não logado tentando acessar rota protegida -> /login
  if (!user && !ehRotaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Já logado tentando acessar login/cadastro -> /dashboard.
  // Exceção: admin em /login ou /cadastro vai direto para o painel /admin.
  // Exceção: /auth/reset-password roda com uma sessão de recuperação — não
  // pode ser desviado, senão o usuário nunca chega a definir a nova senha.
  if (
    user &&
    ehRotaPublica &&
    !pathname.startsWith("/auth") &&
    !pathname.startsWith("/admin/reset-password") &&
    !pathname.startsWith("/admin/forgot-password")
  ) {
    const url = request.nextUrl.clone();
    const ehLoginOuCadastro =
      pathname.startsWith("/login") || pathname.startsWith("/cadastro");
    url.pathname =
      isAdminUser(user) && ehLoginOuCadastro ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  // Painel admin: restrito ao e-mail do dono do SaaS.
  // /admin/login é público (a própria página trata o acesso indevido).
  if (
    pathname.startsWith("/admin") &&
    pathname !== "/admin/login" &&
    !pathname.startsWith("/admin/forgot-password") &&
    !pathname.startsWith("/admin/reset-password") &&
    !isAdminUser(user)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Roda em todas as rotas, exceto assets estáticos e imagens do Next.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
