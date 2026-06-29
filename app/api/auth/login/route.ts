import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  aplicarRateLimit,
  limiterLogin,
  getClientIp,
  tooManyRequests,
} from "@/lib/rate-limit";

/**
 * POST /api/auth/login  { email, senha }
 *
 * Autentica no Supabase Auth no SERVIDOR para podermos aplicar rate limiting
 * (anti força-bruta) — algo impossível na chamada client-side direta ao Auth.
 * Em caso de sucesso, grava os cookies de sessão (@supabase/ssr) na resposta.
 *
 * Rota pública (ver middleware): é chamada por quem ainda não tem sessão.
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; senha?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "payload" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const senha = body.senha ?? "";
  if (!email || !senha) {
    return NextResponse.json({ erro: "credenciais" }, { status: 400 });
  }

  // Rate limit por IP + e-mail: 5 tentativas/min (defesa contra força-bruta).
  const rl = await aplicarRateLimit(limiterLogin, `login:${getClientIp(req)}:${email}`);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  // A sessão é gravada em cookies nesta resposta.
  const response = NextResponse.json({ ok: true });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    return NextResponse.json({ erro: "credenciais_invalidas" }, { status: 401 });
  }

  return response;
}
