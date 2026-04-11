"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { useExplorer } from "../../_explorer/context";
import { fmtNumber } from "../../_explorer/utils";
import { Notice, SectionBlock, SectionHead, ScrollTable, Td, trHover } from "../../_explorer/components";
import { CHART_COLORS, GRID_STROKE, axisProps, gridProps } from "../../_explorer/chartTheme";

type Bucket = { label: string; min: number; max: number; count: number };

const BUCKET_RANGES: [number, number][] = [
  [0, 2],
  [2, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [8, 8.5],
  [8.5, 9],
  [9, 9.5],
  [9.5, 10],
];

// Gradient from red → amber → green → blue for 0→10 range
const BUCKET_COLORS = [
  "#dc2626",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#6366f1",
  "#3040a0",
];

export default function RankingsPage() {
  const { ranks } = useExplorer();

  const histogramData = useMemo<Bucket[]>(() => {
    if (!ranks.data?.items.length) return [];

    return BUCKET_RANGES.map(([min, max]) => ({
      label: `${min}–${max}`,
      min,
      max,
      count: ranks.data!.items.filter(
        (item) => item.sgpa >= min && (max === 10 ? item.sgpa <= max : item.sgpa < max),
      ).length,
    }));
  }, [ranks.data]);

  // Stats
  const stats = useMemo(() => {
    if (!ranks.data?.items.length) return null;
    const sgpas = ranks.data.items.map((i) => i.sgpa);
    const avg = sgpas.reduce((a, b) => a + b, 0) / sgpas.length;
    const sorted = [...sgpas].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg,
      median,
      stdDev: Math.sqrt(sgpas.reduce((s, v) => s + (v - avg) ** 2, 0) / sgpas.length),
    };
  }, [ranks.data]);

  return (
    <div className="p-4 overflow-auto max-h-[calc(100vh-150px)] flex flex-col gap-4">
      {ranks.loading && <Notice>Loading rank list…</Notice>}
      {ranks.error && <Notice error>{ranks.error}</Notice>}

      {ranks.data && (
        <>
          {/* ── SGPA Distribution ─────────────────────────────────────── */}
          <SectionBlock>
            <SectionHead
              title="SGPA Distribution"
              description="Histogram of how students cluster across the 0–10 SGPA range."
            />

            {stats && (
              <div className="grid grid-cols-5 gap-2 text-center">
                {([
                  ["Min", stats.min],
                  ["Max", stats.max],
                  ["Avg", stats.avg],
                  ["Median", stats.median],
                  ["Std Dev", stats.stdDev],
                ] as [string, number][]).map(([label, val]) => (
                  <div
                    key={label}
                    className="border border-dashed border-[#c6ceef] rounded-[10px] bg-[#f7f9ff] px-2 py-2"
                  >
                    <p className="m-0 text-[0.64rem] uppercase tracking-[0.05em] font-bold text-[var(--muted)]">
                      {label}
                    </p>
                    <p className="m-0 text-[1.05rem] font-bold text-[var(--foreground)]">
                      {val.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {histogramData.length > 0 && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histogramData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis {...axisProps} allowDecimals={false} />
                    <Tooltip
                      formatter={(v: any) => [v, "Students"]}
                      contentStyle={{ borderRadius: 10, border: `1px solid ${GRID_STROKE}`, fontSize: 13 }}
                    />
                    <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                      {histogramData.map((_, i) => (
                        <Cell key={i} fill={BUCKET_COLORS[i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionBlock>

          {/* ── Rank Table ─────────────────────────────────────────────── */}
          <ScrollTable maxH="max-h-[50vh]" cols={["Rank", "Register No", "Name", "SGPA"]}>
            {ranks.data.items.map((item) => (
              <tr key={item.regno} className={trHover}>
                <Td>{item.rank}</Td>
                <Td>{item.regno}</Td>
                <Td>{item.name}</Td>
                <Td>{fmtNumber(item.sgpa)}</Td>
              </tr>
            ))}
          </ScrollTable>
        </>
      )}
    </div>
  );
}
