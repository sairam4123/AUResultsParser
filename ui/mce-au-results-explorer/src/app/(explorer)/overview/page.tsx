"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { api, type SummaryResponse } from "../../../lib/api";
import { useExplorer } from "../../_explorer/context";
import { fmtNumber } from "../../_explorer/utils";
import { Notice, SectionBlock, SectionHead, StatTile } from "../../_explorer/components";
import { CHART_COLORS, GRID_STROKE, axisProps, gridProps } from "../../_explorer/chartTheme";

type SemTrendPoint = {
  label: string;
  semester: number;
  passPercentage: number;
  appeared: number;
  passed: number;
  failed: number;
  oneArrear: number;
  twoArrears: number;
  threePlusArrears: number;
  totalArrears: number;
};

export default function OverviewPage() {
  const { summary, meta, department, batch, canQuery } = useExplorer();

  const [trend, setTrend] = useState<SemTrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  // Fetch summary for every available semester to build the trend
  useEffect(() => {
    if (!canQuery || !meta.data?.semesters.length) return;
    setTrendLoading(true);

    const sems = [...meta.data.semesters].sort((a, b) => a - b);

    Promise.allSettled(
      sems.map((sem) => api.getSummary(sem, department, batch || null)),
    ).then((results) => {
      const points: SemTrendPoint[] = [];

      results.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        const s = r.value.summary;
        points.push({
          label: `Sem ${sems[i]}`,
          semester: sems[i],
          passPercentage: s.pass_percentage,
          appeared: s.appeared,
          passed: s.passed,
          failed: s.failed,
          oneArrear: s.one_arrear,
          twoArrears: s.two_arrears,
          threePlusArrears: s["three+_arrears"],
          totalArrears: s.one_arrear + s.two_arrears + s["three+_arrears"],
        });
      });

      setTrend(points);
      setTrendLoading(false);
    });
  }, [canQuery, meta.data, department, batch]);

  return (
    <div className="p-5 flex flex-col gap-5 overflow-auto max-h-[calc(100vh-150px)]">
      <p className="text-[0.95rem] font-bold text-[var(--foreground)] m-0">Semester snapshot</p>
      {summary.loading && <Notice>Refreshing summary…</Notice>}
      {summary.error && <Notice error>{summary.error}</Notice>}
      {summary.data && (
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="One arrear" value={fmtNumber(summary.data.summary.one_arrear)} />
          <StatTile label="Two arrears" value={fmtNumber(summary.data.summary.two_arrears)} />
          <StatTile
            label="Three+ arrears"
            value={fmtNumber(summary.data.summary["three+_arrears"])}
          />
        </div>
      )}

      {/* ── Pass % Trend ─────────────────────────────────────────────── */}
      <SectionBlock>
        <SectionHead
          title="Pass Percentage Trend"
          description="How the pass rate evolves across semesters for this batch."
        />
        {trendLoading && <Notice>Loading trend data…</Notice>}
        {trend.length > 0 && (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis
                  {...axisProps}
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  formatter={(v: any) => [`${Number(v).toFixed(1)}%`, "Pass %"]}
                  contentStyle={{ borderRadius: 10, border: `1px solid ${GRID_STROKE}`, fontSize: 13 }}
                />
                <Line
                  type="monotone"
                  dataKey="passPercentage"
                  name="Pass %"
                  stroke={CHART_COLORS[0]}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: CHART_COLORS[0] }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {!trendLoading && trend.length === 0 && (
          <Notice>No multi-semester data available for this department/batch.</Notice>
        )}
      </SectionBlock>

      {/* ── Arrears Trend ────────────────────────────────────────────── */}
      <SectionBlock>
        <SectionHead
          title="Arrears Trend"
          description="Stacked arrears breakdown across semesters."
        />
        {trend.length > 0 && (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: `1px solid ${GRID_STROKE}`, fontSize: 13 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="oneArrear" name="1 Arrear" stackId="arr" fill={CHART_COLORS[3]} radius={[0, 0, 0, 0]} />
                <Bar dataKey="twoArrears" name="2 Arrears" stackId="arr" fill={CHART_COLORS[1]} />
                <Bar dataKey="threePlusArrears" name="3+ Arrears" stackId="arr" fill="#b91c1c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionBlock>
    </div>
  );
}
