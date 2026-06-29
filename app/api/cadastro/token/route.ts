import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-service";
import { getPlano } from "@/lib/planos";
import {
  aplicarRateLimit,
  limiterCadastro,
  getClientIp,
  tooManyRequests,
} from "@/lib/rate-limit";

/**
 * /api/cadastro/token
 *
 * Suporte ao onboarding pós-pagamento tokenizado:
 *
 *   GET  ?token=...   → valida o token e devolve { email, plano } para a tela
 *                       de cadastro pré-preencher o e-mail.
 *   POST { token, senha } → valida de novo, cria o usuário no Supabase Auth
 *                       (o trigger on_auth_user_created provisiona tenant +
 *                       users), ajusta o tenant com o plano contratado e marca
 *                       o token como usado.
 *
 * Usa a SERVICE ROLE (bypassa RLS). Rota pública (ver middleware): é acessada
 * antes de existir sessão de usuário.
 */

type TokenRow = {
  id: string;
  email: string;
  plano: string;
  usado: boolean;
  expira_em: string;
};

/** Busca e valida o token. Retorna a linha ou um motivo de invalidez. */
async function carregarToken(
  supabase: ReturnType<typeof createServiceSupabase>,
  token: string,
): Promise<{ row: TokenRow } | { erro: string }> {
  if (!token) return { erro: "ausente" };

  const { data, error } = await supabase
    .from("onboarding_tokens")
    .select("id, email, plano, usado, expira_em")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("[cadastro/token] erro ao buscar token:", error);
    return { erro: "interno" };
  }
  if (!data) return { erro: "invalido" };
  if (data.usado) return { erro: "usado" };
  if (new Date(data.expira_em).getTime() < Date.now()) return { erro: "expirado" };

  return { row: data as TokenRow };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get("token") ?? "").trim();

  const supabase = createServiceSupabase();
  const res = await carregarToken(supabase, token);

  if ("erro" in res) {
    return NextResponse.json({ valido: false, motivo: res.erro }, { status: 200 });
  }

  return NextResponse.json(
    { valido: true, email: res.row.email, plano: res.row.plano },
    { status: 200 },
  );
}

export async function POST(req: Request) {
  // Rate limit: cria conta no Auth — protege contra abuso/força bruta de token.
  const rl = await aplicarRateLimit(limiterCadastro, `cadastro:${getClientIp(req)}`);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  let body: { token?: string; senha?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "payload" }, { status: 400 });
  }

  const token = (body.token ?? "").trim();
  const senha = body.senha ?? "";

  if (senha.length < 6) {
    return NextResponse.json({ erro: "senha_curta" }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  const res = await carregarToken(supabase, token);
  if ("erro" in res) {
    return NextResponse.json({ erro: res.erro }, { status: 400 });
  }

  const { row } = res;
  const plano = getPlano(row.plano);
  if (!plano) {
    return NextResponse.json({ erro: "plano_invalido" }, { status: 400 });
  }
  const email = row.email.trim().toLowerCase();

  // 1) Cria a conta já confirmada, com a senha escolhida pelo cliente.
  //    O trigger on_auth_user_created provisiona tenant + users.
  const { data: created, error: createErr } =
    await supabase.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome: email },
    });

  const userId = created?.user?.id ?? null;

  if (!userId) {
    const jaExiste =
      createErr?.status === 422 ||
      /already.*registered|already.*exists/i.test(createErr?.message ?? "");
    if (jaExiste) {
      return NextResponse.json({ erro: "ja_cadastrado" }, { status: 409 });
    }
    console.error("[cadastro/token] erro ao criar usuário:", createErr);
    return NextResponse.json({ erro: "interno" }, { status: 500 });
  }

  // 2) Localiza o tenant criado pelo trigger e marca o plano contratado.
  const { data: userRow } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();
  const tenantId = userRow?.tenant_id ?? null;

  if (tenantId) {
    // Sem período no token: assume mensal (vencimento +1 mês).
    const venc = new Date();
    venc.setMonth(venc.getMonth() + 1);

    await supabase
      .from("tenants")
      .update({
        pais: "AR",
        idioma: "es",
        moeda_preferida: "ARS",
        plano: plano.id,
        ativo: true,
        status_assinatura: "pago",
        forma_pagamento: "mercado_pago",
        vencimento: venc.toISOString().slice(0, 10),
      })
      .eq("id", tenantId);
  }

  // 3) Marca o token como usado (consome o link de cadastro).
  await supabase
    .from("onboarding_tokens")
    .update({ usado: true })
    .eq("id", row.id);

  return NextResponse.json({ ok: true, email }, { status: 200 });
}
