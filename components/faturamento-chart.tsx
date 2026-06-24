"use client";

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

  return (
    <div className="h-72 w-full">
      {vazio ? (
        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-200 dark:border-gray-800 text-sm text-gray-400 dark:text-gray-500">
          {labelVazio}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis
              dataKey="mes"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#6b7280", fontSize: 12 }}
            />
            <YAxis
              tickFormatter={fmtCompacto}
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: "#9ca3af", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "#11111108" }}
              formatter={(value) => [
                fmtMoeda(Number(value) || 0, moeda),
                labelFaturado,
              ]}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 12,
                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              }}
            />
            <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {dados.map((d, i) => (
                <Cell
                  key={d.mes}
                  fill={i === dados.length - 1 ? "#0F0F0F" : "#d4d4d8"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
