"use client";

import { usePathname, useRouter } from "next/navigation";
import { PERIODOS, normalizarPeriodo, type PeriodoKey } from "@/lib/periodo";

type Opcoes = Record<PeriodoKey, string>;

const selectCls =
  "rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 outline-none transition hover:bg-gray-50 dark:hover:bg-gray-800 focus:border-gray-900 dark:focus:border-gray-400";

/**
 * Seletor de período controlado (UI pura). O consumidor decide de onde vem o
 * valor e para onde vai o onChange — usado tanto em telas client (estado local)
 * quanto via wrapper de navegação em telas server.
 */
export function PeriodoSelect({
  value,
  onChange,
  label,
  opcoes,
}: {
  value: PeriodoKey;
  onChange: (p: PeriodoKey) => void;
  label: string;
  opcoes: Opcoes;
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(normalizarPeriodo(e.target.value))}
        className={selectCls}
      >
        {PERIODOS.map((p) => (
          <option key={p} value={p}>
            {opcoes[p]}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Variante para telas server (ex.: Financeiro): reflete o período na URL
 * (?periodo=...), disparando o re-render da página com dados frescos. Mantém a
 * fonte de dados intacta — só muda o parâmetro lido no servidor.
 */
export function PeriodoSelectNav({
  value,
  label,
  opcoes,
}: {
  value: PeriodoKey;
  label: string;
  opcoes: Opcoes;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function onChange(p: PeriodoKey) {
    try {
      router.push(`${pathname}?periodo=${p}`);
    } catch (e) {
      console.error("[PeriodoSelectNav] navegação falhou:", e);
    }
  }

  return (
    <PeriodoSelect value={value} onChange={onChange} label={label} opcoes={opcoes} />
  );
}
