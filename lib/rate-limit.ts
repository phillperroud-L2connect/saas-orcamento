/**
 * Rate limiting distribuído com Upstash Redis (@upstash/ratelimit).
 *
 * Substitui o antigo limiter em memória: funciona de forma consistente entre
 * múltiplas instâncias serverless (Vercel), pois o estado vive no Redis.
 *
 * Configuração (.env.local + Vercel):
 *   UPSTASH_REDIS_REST_URL   — URL REST do banco Upstash
 *   UPSTASH_REDIS_REST_TOKEN — token REST do banco Upstash
 *
 * Fail-open: se as variáveis não estiverem configuradas, o rate limiting é
 * DESLIGADO (as rotas continuam funcionando) e um aviso é logado. Assim uma
 * falha de configuração do Redis não derruba o produto — rate limiting protege
 * disponibilidade, não é um controle de autenticação.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

if (!redis) {
  console.warn(
    "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN ausentes — rate limiting DESATIVADO.",
  );
}

/** Cria um limiter (ou null se o Redis não estiver configurado). */
function criarLimiter(max: number, janela: Parameters<typeof Ratelimit.slidingWindow>[1], prefix: string) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, janela),
    prefix,
    analytics: false,
  });
}

/**
 * Limiters por rota crítica. Janelas escolhidas conservadoramente:
 *  - login:     5 tentativas / min  (anti força-bruta de senha)
 *  - cadastro: 10 / 5 min           (cria conta no Auth via token)
 *  - pagamento:20 / min             (cria preferência no Mercado Pago)
 *  - webhook: 120 / min             (generoso: rajadas legítimas do MP)
 *  - status:   60 / min             (polling do checkout — 1 req a cada ~4s)
 */
export const limiterLogin = criarLimiter(5, "1 m", "rl:login");
export const limiterCadastro = criarLimiter(10, "5 m", "rl:cadastro");
export const limiterPagamento = criarLimiter(20, "1 m", "rl:pagamento");
export const limiterWebhook = criarLimiter(120, "1 m", "rl:webhook");
export const limiterStatus = criarLimiter(60, "1 m", "rl:status");

export type RateLimitResult = {
  ok: boolean;
  /** Requisições restantes na janela (-1 quando o limiter está desativado). */
  restante: number;
  /** Segundos até a janela reabrir (header Retry-After). */
  retryAfter: number;
};

/**
 * Aplica o limiter à `chave` (normalmente `ip` ou `ip:email`).
 * Quando o limiter é null (Redis não configurado), libera (fail-open).
 */
export async function aplicarRateLimit(
  limiter: Ratelimit | null,
  chave: string,
): Promise<RateLimitResult> {
  if (!limiter) return { ok: true, restante: -1, retryAfter: 0 };

  try {
    const { success, remaining, reset } = await limiter.limit(chave);
    return {
      ok: success,
      restante: remaining,
      retryAfter: success ? 0 : Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
    };
  } catch (err) {
    // Falha de rede com o Redis não deve derrubar a rota: fail-open + log.
    console.error("[rate-limit] erro ao consultar Upstash (fail-open):", err);
    return { ok: true, restante: -1, retryAfter: 0 };
  }
}

/** Extrai o IP do cliente a partir dos headers de proxy (Vercel/edge). */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "desconhecido";
}

/** Resposta 429 padronizada com Retry-After. */
export function tooManyRequests(retryAfter: number): Response {
  return new Response(JSON.stringify({ erro: "rate_limited", retryAfter }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(Math.max(retryAfter, 1)),
    },
  });
}
