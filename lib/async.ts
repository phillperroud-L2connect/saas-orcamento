/**
 * Watchdog para promessas: rejeita se a operação não resolver dentro de `ms`.
 * Blinda chamadas de rede/DB (Supabase, Mercado Pago) contra travamentos que
 * segurariam o handler do webhook indefinidamente.
 */
export async function withTimeout<T>(
  operacao: PromiseLike<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const watchdog = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`timeout após ${ms}ms: ${label}`)),
      ms,
    );
  });
  try {
    return (await Promise.race([operacao, watchdog])) as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
