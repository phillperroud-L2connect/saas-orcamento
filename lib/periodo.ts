// Lógica pura e determinística do filtro de período usado nas telas
// Financeiro (Finanzas) e Pagamentos (Pagos). Sem rede/DB: recebe uma data de
// referência (default: agora) e devolve os meses/chaves que compõem a janela.
//
// A fonte de dados das duas telas continua a mesma (todos os orçamentos/avulsos
// do tenant); estas funções só decidem QUAIS meses entram em cada agregação,
// evitando duplicar a lógica de intervalo entre as telas.

export type PeriodoKey = "mes" | "3meses" | "6meses" | "ano";

export const PERIODOS: PeriodoKey[] = ["mes", "3meses", "6meses", "ano"];

export const PERIODO_PADRAO: PeriodoKey = "mes";

/** Garante um PeriodoKey válido a partir de um valor externo (query, select). */
export function normalizarPeriodo(valor: unknown): PeriodoKey {
  return PERIODOS.includes(valor as PeriodoKey)
    ? (valor as PeriodoKey)
    : PERIODO_PADRAO;
}

/** Chave AAAA-MM para agrupar por mês independente de fuso. */
export function chaveMes(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Quantidade de meses que o período abrange, ancorado em `ref`. */
export function qtdMeses(periodo: PeriodoKey, ref: Date = new Date()): number {
  switch (periodo) {
    case "3meses":
      return 3;
    case "6meses":
      return 6;
    case "ano":
      return ref.getMonth() + 1; // de janeiro até o mês atual
    case "mes":
    default:
      return 1;
  }
}

export type MesPeriodo = { ano: number; mes: number; chave: string };

/**
 * Lista de meses (do mais antigo ao atual) que compõem o período, para
 * alimentar tanto o gráfico quanto as agregações. Nunca lança: em erro
 * inesperado cai no mês atual.
 */
export function mesesDoPeriodo(
  periodo: PeriodoKey,
  ref: Date = new Date(),
): MesPeriodo[] {
  try {
    const n = qtdMeses(periodo, ref);
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(ref.getFullYear(), ref.getMonth() - (n - 1 - i), 1);
      return { ano: d.getFullYear(), mes: d.getMonth(), chave: chaveMes(d) };
    });
  } catch (e) {
    console.error("[periodo] mesesDoPeriodo falhou:", e);
    const d = new Date(ref.getFullYear(), ref.getMonth(), 1);
    return [{ ano: d.getFullYear(), mes: d.getMonth(), chave: chaveMes(d) }];
  }
}

/** Conjunto de chaves AAAA-MM do período atual (janela selecionada). */
export function chavesDoPeriodo(
  periodo: PeriodoKey,
  ref: Date = new Date(),
): Set<string> {
  return new Set(mesesDoPeriodo(periodo, ref).map((m) => m.chave));
}

/**
 * Chaves do período imediatamente anterior, do mesmo tamanho da janela atual —
 * base para o comparativo "período anterior". Nunca lança.
 */
export function chavesPeriodoAnterior(
  periodo: PeriodoKey,
  ref: Date = new Date(),
): Set<string> {
  try {
    const n = qtdMeses(periodo, ref);
    // Início da janela atual = n-1 meses antes do mês de referência.
    const inicioAtual = new Date(ref.getFullYear(), ref.getMonth() - (n - 1), 1);
    const chaves = new Set<string>();
    for (let i = 1; i <= n; i++) {
      const d = new Date(
        inicioAtual.getFullYear(),
        inicioAtual.getMonth() - i,
        1,
      );
      chaves.add(chaveMes(d));
    }
    return chaves;
  } catch (e) {
    console.error("[periodo] chavesPeriodoAnterior falhou:", e);
    return new Set();
  }
}
