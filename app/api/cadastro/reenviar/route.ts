import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createServiceSupabase } from "@/lib/supabase-service";
import { garantirOnboarding } from "@/lib/onboarding";
import { decidirReenvioAtivacao, padDeTempo } from "@/lib/onboarding-core";
import { getPlano, isPeriodo, type Periodo } from "@/lib/planos";
import type { Pais } from "@/lib/types";
import { withTimeout, sleep } from "@/lib/async";
import {
  aplicarRateLimit,
  limiterReativacaoIp,
  limiterReativacaoToken,
  getClientIp,
  tooManyRequests,
} from "@/lib/rate-limit";

const DB_TIMEOUT_MS = 8_000;

/**
 * Orçamento de tempo FIXO da resposta. Todo desfecho (token desconhecido, e-mail
 * não pago, conta já ativada, reenvio efetivo, falha interna) leva ~o mesmo
 * tempo. Sem isso, o caminho "nada a fazer" voltaria em milissegundos e o
 * caminho "reenviei" levaria centenas de ms — um oráculo de timing revelando
 * quem pagou. Ver anti-enumeração abaixo.
 */
const BUDGET_MS = 1_500;

/**
 * POST /api/cadastro/reenviar  { token }
 *
 * Renovação SELF-SERVE de token de ativação expirado. Quando o cliente abre
 * /cadastro?token=... depois das 24h, em vez de um beco sem saída ele clica um
 * botão que gera um token NOVO e reenvia o e-mail de ativação — sem intervenção
 * manual no banco. Reusa `garantirOnboarding(..., forcarReenvio:true)` (a mesma
 * peça da Etapa 3), agora acionado pelo próprio dono da conta recuperando acesso.
 *
 * Rota PÚBLICA (herda o allowlist de /api/cadastro no middleware) — é chamada
 * antes de existir sessão. Por ser pública, os cuidados abaixo são a ÚNICA linha
 * de defesa:
 *
 *  - Corpo = { token }, NÃO { email }. O e-mail é resolvido no servidor a partir
 *    do token que o cliente já possui, nunca é digitado nem devolvido. Assim é
 *    impossível sondar e-mails arbitrários: só quem tem um link real dispara o
 *    reenvio, que sempre vai ao dono legítimo daquele e-mail.
 *
 *  - Anti-enumeração: a resposta é SEMPRE `{ ok: true }` 200, idêntica em todos
 *    os ramos (corpo e status), e o tempo de resposta é padronizado (BUDGET_MS).
 *    Nunca revela se o token existe, se o e-mail pagou, ou se já ativou — nem por
 *    mensagem nem por timing. O único status diferente é o 429 dos limiters, que
 *    são chaveados por IP / hash-de-token (dado opaco), não pela identidade da
 *    conta, então também não vazam existência.
 *
 *  - Regra de negócio (revalidada no servidor, sem confiar no cliente): só
 *    reenvia para e-mail com assinatura aprovada e SEM tenant (pago-sem-ativar),
 *    via `decidirReenvioAtivacao` — a mesma da Etapa 3.
 */
export async function POST(req: Request) {
  const t0 = Date.now();

  // Rate limit por IP: corta varredura em massa ANTES de qualquer leitura no
  // banco. Chave = IP (opaca quanto à conta) → o 429 não revela nada do e-mail.
  const rlIp = await aplicarRateLimit(
    limiterReativacaoIp,
    `reativacao-ip:${getClientIp(req)}`,
  );
  if (!rlIp.ok) return tooManyRequests(rlIp.retryAfter);

  let body: { token?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const token = (body.token ?? "").trim();

  // Rate limit por hash do token: corta flood do inbox de uma vítima via um
  // mesmo link. sha256 evita gravar o segredo em claro nas chaves do Redis. Só
  // consome cota quando veio algum token — mas nunca depende de o token ser
  // válido/pago, então continua sem virar oráculo.
  if (token) {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const rlTok = await aplicarRateLimit(
      limiterReativacaoToken,
      `reativacao-tok:${tokenHash}`,
    );
    if (!rlTok.ok) return tooManyRequests(rlTok.retryAfter);
  }

  // Todo o trabalho roda aqui e o RESULTADO É IGNORADO: a resposta é sempre
  // genérica. Erros são engolidos (só logados) para não virarem sinal.
  try {
    if (token) await processarReenvio(token);
  } catch (err) {
    console.error("[cadastro/reenviar] erro (ignorado p/ resposta genérica):", err);
  }

  // Padroniza o tempo total. Resíduo honesto: um envio Resend acima do orçamento
  // ainda pode exceder BUDGET_MS — sinal fraco e ruidoso, e os limiters acima já
  // reduzem a sondagem a um filete.
  await sleep(padDeTempo(BUDGET_MS, Date.now() - t0));
  return NextResponse.json({ ok: true }, { status: 200 });
}

/**
 * Núcleo do reenvio: resolve o e-mail do token, revalida a regra pago-sem-tenant
 * e reusa `garantirOnboarding`. Não retorna nada útil de propósito — qualquer
 * desvio (token desconhecido, não pago, já ativado, plano indefinido) apenas
 * retorna cedo, caindo na mesma resposta genérica do chamador.
 */
async function processarReenvio(token: string): Promise<void> {
  const svc = createServiceSupabase();

  // Resolve o e-mail a partir do token — QUALQUER token da tabela, inclusive
  // expirado ou já usado: aqui só interessa a quem o link pertence. (A validade
  // para ATIVAR é checada em /api/cadastro/token; para REEMITIR, não importa.)
  const { data: tok } = await withTimeout(
    svc.from("onboarding_tokens").select("email").eq("token", token).maybeSingle(),
    DB_TIMEOUT_MS,
    "resolver e-mail do token de reativação",
  );
  const email = (tok?.email ?? "").trim().toLowerCase();
  if (!email) return; // token desconhecido → nada a fazer.

  // Regra pago-sem-tenant (mesma da Etapa 3, agora sem proteção admin).
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
      "buscar assinatura paga (reativação)",
    ),
    withTimeout(
      svc.from("tenants").select("id").eq("email", email).maybeSingle(),
      DB_TIMEOUT_MS,
      "buscar tenant por e-mail (reativação)",
    ),
  ]);

  const { permitido } = decidirReenvioAtivacao({
    temAssinaturaPaga: !!assinatura,
    tenantExiste: !!tenant?.id,
  });
  if (!permitido) return; // não pago, ou já ativado → nada.

  // plano/periodo/pais para o reenvio: token mais recente do e-mail é a fonte de
  // verdade (o webhook grava isso); fallback pela assinatura. Idêntico à Etapa 3.
  const { data: tokRecente } = await withTimeout(
    svc
      .from("onboarding_tokens")
      .select("plano, periodo, pais")
      .eq("email", email)
      .order("expira_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
    DB_TIMEOUT_MS,
    "buscar token mais recente (reativação)",
  );

  const planoId = String(tokRecente?.plano ?? assinatura?.plano ?? "");
  const plano = getPlano(planoId);
  if (!plano) {
    console.error("[cadastro/reenviar] plano indefinido:", { email, planoId });
    return;
  }

  const periodoTok = String(tokRecente?.periodo ?? "");
  const periodo: Periodo = isPeriodo(periodoTok) ? periodoTok : "mensal";
  const pais: Pais =
    (tokRecente?.pais as Pais | undefined) ??
    (assinatura?.moeda === "BRL" ? "BR" : "AR");

  // Reusa o garantirOnboarding: como o token do cliente expirou, gera um NOVO
  // (24h) e reenvia. tenantExiste=false garantido pela regra acima; forcarReenvio
  // porque é ação deliberada do próprio dono recuperando acesso.
  await garantirOnboarding(svc, {
    email,
    plano,
    periodo,
    pais,
    tenantExiste: false,
    forcarReenvio: true,
  });
}
