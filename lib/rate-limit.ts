/**
 * Rate limiting leve, em memória (best-effort) para rotas de API públicas.
 *
 * Estratégia: janela deslizante simples por chave (normalmente o IP do
 * requisitante), guardada no escopo do módulo. Em instâncias serverless
 * "quentes" (Vercel) protege contra rajadas vindas de um mesmo IP; instâncias
 * frias zeram o contador, então NÃO é uma garantia global.
 *
 * Para limitação distribuída e robusta em produção, troque por um store
 * compartilhado (ex.: @upstash/ratelimit + Redis). A interface abaixo foi
 * pensada para essa migração ser trivial.
 */

type Registro = { count: number; reset: number };

const buckets = new Map<string, Registro>();

export type RateLimitResult = {
  ok: boolean;
  /** Quantas requisições ainda restam na janela atual. */
  restante: number;
  /** Segundos até a janela reabrir (para o header Retry-After). */
  retryAfter: number;
};

/**
 * Consome 1 unidade da cota de `chave`.
 *
 * @param chave   Identificador (ex.: `ip:rota`).
 * @param limite  Máximo de requisições permitidas na janela.
 * @param janelaMs Tamanho da janela em milissegundos.
 */
export function rateLimit(
  chave: string,
  limite: number,
  janelaMs: number,
): RateLimitResult {
  const agora = Date.now();
  const reg = buckets.get(chave);

  if (!reg || agora > reg.reset) {
    buckets.set(chave, { count: 1, reset: agora + janelaMs });
    return { ok: true, restante: limite - 1, retryAfter: 0 };
  }

  reg.count += 1;
  if (reg.count > limite) {
    return {
      ok: false,
      restante: 0,
      retryAfter: Math.ceil((reg.reset - agora) / 1000),
    };
  }

  return { ok: true, restante: limite - reg.count, retryAfter: 0 };
}

/** Extrai o IP do cliente a partir dos headers de proxy (Vercel/edge). */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "desconhecido";
}

/** Resposta 429 padronizada com Retry-After. */
export function tooManyRequests(retryAfter: number): Response {
  return new Response(
    JSON.stringify({ erro: "rate_limited", retryAfter }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.max(retryAfter, 1)),
      },
    },
  );
}
