"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtMoeda } from "@/lib/moeda";
import type { MoedaPreferida } from "@/lib/types";

export type PontoFaturamento = {
  mes: string; // rótulo curto, ex: "jan/26"
  total: number;
};

/** Eixo Y compacto: 1.2k / 3.4M */
function fmtCompacto(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

/**
 * Observa a classe `.dark` no <html> (fonte da verdade do tema) para que as
 * cores do gráfico — desenhadas via SVG/JS, fora do alcance das classes
 * `dark:` do Tailwind — acompanhem o tema, inclusive ao alternar em tempo real.
 */
function useTemaEscuro() {
  const [escuro, setEscuro] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setEscuro(root.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return escuro;
}

export function FaturamentoChart({
  dados,
  moeda,
  labelFaturado,
  labelVazio,
}: {
  dados: PontoFaturamento[];
  moeda: MoedaPreferida;
  labelFaturado: string;
  labelVazio: string;
}) {
  const vazio = dados.every((d) => d.total === 0);
  const escuro = useTemaEscuro();

  // Paleta sensível ao tema (cores SVG não são alcançadas por classes `dark:`).
  const corGrade = escuro ? "#27272a" : "#f0f0f0"; // grade horizontal
  const corDestaque = escuro ? "#f4f4f5" : "#0F0F0F"; // barra do mês atual
  const corBarra = escuro ? "#3f3f46" : "#d4d4d8"; // demais barras
  const corTickX = escuro ? "#9ca3af" : "#6b7280";
  const corTickY = escuro ? "#71717a" : "#9ca3af";

  return (
    <div className="h-72 w-full">
      {vazio ? (
        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-200 dark:border-gray-800 text-sm text-gray-400 dark:text-gray-500">
          {labelVazio}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={corGrade}
            />
            <XAxis
              dataKey="mes"
              tickLine={false}
              axisLine={false}
              tick={{ fill: corTickX, fontSize: 12 }}
            />
            <YAxis
              tickFormatter={fmtCompacto}
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: corTickY, fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: escuro ? "#ffffff14" : "#11111108" }}
              formatter={(value) => [
                fmtMoeda(Number(value) || 0, moeda),
                labelFaturado,
              ]}
              contentStyle={{
                borderRadius: 8,
                border: `1px solid ${escuro ? "#3f3f46" : "#e5e7eb"}`,
                background: escuro ? "#18181b" : "#ffffff",
                color: escuro ? "#f4f4f5" : "#111111",
                fontSize: 12,
                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              }}
              labelStyle={{ color: escuro ? "#a1a1aa" : "#6b7280" }}
              itemStyle={{ color: escuro ? "#f4f4f5" : "#111111" }}
            />
            <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {dados.map((d, i) => (
                <Cell
                  key={d.mes}
                  fill={i === dados.length - 1 ? corDestaque : corBarra}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
