import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-service";
import { getSiteUrl } from "@/lib/mercadopago";
import { isAdminEmail } from "@/lib/admin";
import { enviarRecuperacaoAdmin } from "@/lib/email";
import { withTimeout } from "@/lib/async";
import {
  aplicarRateLimit,
  limiterLogin,
  getClientIp,
  tooManyRequests,
} from "@/lib/rate-limit";

const DB_TIMEOUT_MS = 8_000;
const EMAIL_TIMEOUT_MS = 10_000;

/**
 * POST /api/admin/recuperar-senha  { email }
 *
 * Recuperação de senha do PAINEL ADMIN. Só age para o e-mail do admin; para
 * qualquer outro responde sucesso genérico (não revela se a conta existe).
 * O token vem do Supabase (mesma expiração/uso único do fluxo de usuário); o
 * e-mail é próprio (Resend) com assunto administrativo.
 *
 * Rota pública (ver middleware): chamada por quem não tem sessão.
 */
export async function POST(req: Request) {
  const rl = await aplicarRateLimit(
    limiterLogin,
    `admin-recuperar:${getClientIp(req)}`,
  );
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  let body: { email?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "payload" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const respostaGenerica = NextResponse.json({ ok: true }, { status: 200 });

  // Nunca revela se o e-mail é (ou não) o do admin.
  if (!email || !isAdminEmail(email)) return respostaGenerica;

  try {
    const supabase = createServiceSupabase();
    const redirectTo = `${getSiteUrl()}/admin/reset-password`;

    const { data, error } = await withTimeout(
      supabase.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      }),
      DB_TIMEOUT_MS,
      "gerar link de recuperação do admin",
    );

    if (error || !data?.properties?.hashed_token) {
      console.error("[admin/recuperar-senha] falha ao gerar link:", error);
      return respostaGenerica;
    }

    const link = `${redirectTo}?token_hash=${data.properties.hashed_token}&type=recovery`;

    await withTimeout(
      enviarRecuperacaoAdmin({ email, link }),
      EMAIL_TIMEOUT_MS,
      "enviar e-mail de recuperação do admin",
    );

    return respostaGenerica;
  } catch (err) {
    console.error("[admin/recuperar-senha] erro inesperado:", err);
    return respostaGenerica;
  }
}
