import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createServiceSupabase } from "@/lib/supabase-service";
import { isAdminUser } from "@/lib/admin";
import { withTimeout } from "@/lib/async";
import { garantirOnboarding } from "@/lib/onboarding";
import { decidirReenvioAtivacao } from "@/lib/onboarding-core";
import { getPlano, isPeriodo, type Periodo } from "@/lib/planos";
import type { Pais } from "@/lib/types";
import {
  aplicarRateLimit,
  limiterAdmin,
  getClientIp,
  tooManyRequests,
} from "@/lib/rate-limit";

const DB_TIMEOUT_MS = 8_000;

/**
 * POST /api/admin/reenviar-ativacao  { email }
 *
 * Reenvia o link de ativação (token de cadastro de 24h + e-mail PT/ES) para um
 * cliente que PAGOU mas ainda NÃO ativou a conta. Reusa exatamente o
 * `garantirOnboarding` da Etapa 2, com `forcarReenvio: true` — o único caminho
 * que reenvia mesmo quando o 1º e-mail já foi confirmado (cliente que recebeu e
 * perdeu / caiu no spam). Só o admin logado executa.
 *
 * Regra de negócio (revalidada aqui no servidor, sem confiar no cliente):
 *   - precisa ter assinatura aprovada com esse e-mail; senão 400;
 *   - NÃO pode já ter tenant (conta ativada); senão 409 — não faz sentido
 *     reenviar ativação a quem já ativou.
 *
 * `periodo`/`pais` não existem em `assinaturas`: vêm do onboarding_tokens mais
 * recente (gravado pelo webhook). Fallback quando não há token: pais derivado da
 * moeda da assinatura (BRL→BR, senão AR) e periodo 'mensal'.
 */
export async function POST(req: NextRequest) {
  // 1. Só o admin logado pode reenviar.
  const authClient = createServerSupabase();
  const {
    data: { user },
  } = await withTimeout(
    authClient.auth.getUser(),
    DB_TIMEOUT_MS,
    "validar sessão do admin",
  );
  if (!isAdminUser(user)) {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 403 });
  }

  // Rate limit da ação (após confirmar que é o admin logado).
  const rl = await aplicarRateLimit(limiterAdmin, `reenviar-ativacao:${getClientIp(req)}`);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  let body: { email?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "payload" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ erro: "email_ausente" }, { status: 400 });
  }

  try {
    const svc = createServiceSupabase();

    // 2. Estado do e-mail: assinatura aprovada? já virou tenant?
    const [{ data: assinatura }, { data: tenant }] = await Promise.all([
      withTimeout(
        svc
          .from("assinaturas")
          .select("plano, moeda")
          .eq("email", email)
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        DB_TIMEOUT_MS,
        "buscar assinatura paga",
      ),
      withTimeout(
        svc.from("tenants").select("id").eq("email", email).maybeSingle(),
        DB_TIMEOUT_MS,
        "buscar tenant por e-mail",
      ),
    ]);

    // 3. Regra pago-sem-tenant (pura, testável).
    const { permitido, motivo } = decidirReenvioAtivacao({
      temAssinaturaPaga: !!assinatura,
      tenantExiste: !!tenant?.id,
    });
    if (!permitido) {
      // sem_assinatura_paga → 400 (nada a ativar); ja_ativado → 409 (já tem conta).
      const status = motivo === "ja_ativado" ? 409 : 400;
      return NextResponse.json({ erro: motivo }, { status });
    }

    // 4. periodo/pais/plano para o (re)envio: token mais recente é a fonte de
    //    verdade (o webhook grava plano/periodo/pais). Fallback pela assinatura.
    const { data: tok } = await withTimeout(
      svc
        .from("onboarding_tokens")
        .select("plano, periodo, pais")
        .eq("email", email)
        .order("expira_em", { ascending: false })
        .limit(1)
        .maybeSingle(),
      DB_TIMEOUT_MS,
      "buscar token de onboarding",
    );

    const planoId = String(tok?.plano ?? assinatura?.plano ?? "");
    const plano = getPlano(planoId);
    if (!plano) {
      console.error("[admin/reenviar-ativacao] plano indefinido:", { email, planoId });
      return NextResponse.json({ erro: "plano_indefinido" }, { status: 400 });
    }

    const periodoTok = String(tok?.periodo ?? "");
    const periodo: Periodo = isPeriodo(periodoTok) ? periodoTok : "mensal";
    const pais: Pais =
      (tok?.pais as Pais | undefined) ??
      (assinatura?.moeda === "BRL" ? "BR" : "AR");

    // 5. Reusa o garantirOnboarding da Etapa 2, forçando o reenvio (ação humana).
    //    tenantExiste=false garantido pela regra acima.
    const onb = await garantirOnboarding(svc, {
      email,
      plano,
      periodo,
      pais,
      tenantExiste: false,
      forcarReenvio: true,
    });

    if (onb.precisaRetry) {
      // Falha ao criar token ou enviar e-mail — nada foi carimbado como enviado.
      return NextResponse.json({ erro: "onboarding_falhou" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, acao: onb.acao }, { status: 200 });
  } catch (err) {
    console.error("[admin/reenviar-ativacao] erro inesperado:", err);
    return NextResponse.json({ erro: "interno" }, { status: 500 });
  }
}
