import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAdminUser } from "@/lib/admin";

// Rotas públicas — acessíveis sem autenticação.
// /checkout e /api/mp são públicas: a venda acontece antes de existir conta,
// e o webhook do Mercado Pago chega sem sessão de usuário.
const ROTAS_PUBLICAS = [
  "/login",
  "/cadastro",
  "/admin/login",
  "/checkout",
  "/api/mp",
  // Login server-side (rate-limited) — chamado por quem ainda não tem sessão.
  "/api/auth",
  // Validação/criação de conta por token (onboarding pós-pagamento), sem sessão.
  "/api/cadastro",
  // Página pública de pagamento do orçamento (cliente final, sem conta).
  "/pagar",
  // Recuperação de senha: forgot-password (sem sessão) e reset-password
  // (só ganha a sessão de recuperação após trocar o code do link do e-mail).
  "/auth",
];

export async function middleware(request: NextRequest) {
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
  if (user && ehRotaPublica && !pathname.startsWith("/auth")) {
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
