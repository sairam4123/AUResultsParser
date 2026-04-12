"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../../../lib/api";
import { axisProps, gridProps } from "../../_explorer/chartTheme";
import { useExplorer } from "../../_explorer/context";
import { initialDataState, type DataState } from "../../_explorer/types";
import { fmtNumber } from "../../_explorer/utils";

type OverviewTrendPoint = {
  semester: number;
  passPercentage: number;
  oneArrear: number;
  twoArrears: number;
  threePlusArrears: number;
  appeared: number;
  passed: number;
  failed: number;
  source: string;
};

export default function OverviewPage() {
  const { summary, canQuery, department, batch, meta, selectedSemesters } =
    useExplorer();
  const [trends, setTrends] =
    useState<DataState<OverviewTrendPoint[]>>(initialDataState);

  const semesters = useMemo(
    () =>
      selectedSemesters.length > 0
        ? [...selectedSemesters].sort((a, b) => a - b)
        : [...(meta.data?.semesters ?? [])].sort((a, b) => a - b),
    [meta.data?.semesters, selectedSemesters],
  );

  useEffect(() => {
    if (!canQuery || semesters.length === 0) {
      setTrends(initialDataState);
      return;
    }

    let active = true;
    setTrends({ loading: true, error: null, data: null });

    void Promise.allSettled(
      semesters.map((sem) => api.getSummary(sem, department, batch || null)),
    ).then((results) => {
      if (!active) return;

      const points: OverviewTrendPoint[] = [];
      const failures: string[] = [];

      results.forEach((result, idx) => {
        if (result.status === "fulfilled") {
          points.push({
            semester: semesters[idx],
            passPercentage: result.value.summary.pass_percentage,
            oneArrear: result.value.summary.one_arrear,
            twoArrears: result.value.summary.two_arrears,
            threePlusArrears: result.value.summary["three+_arrears"],
            appeared: result.value.summary.appeared,
            passed: result.value.summary.passed,
            failed: result.value.summary.failed,
            source: result.value.source,
          });
          return;
        }

        const message =
          result.reason instanceof Error
            ? result.reason.message
            : "Failed to load semester";
        failures.push(`S${semesters[idx]}: ${message}`);
      });

      if (points.length === 0) {
        setTrends({
          loading: false,
          error: failures[0] ?? "Unable to load analytics trends.",
          data: null,
        });
        return;
      }

      points.sort((a, b) => a.semester - b.semester);
      setTrends({
        loading: false,
        error: failures.length > 0 ? failures.slice(0, 2).join(" | ") : null,
        data: points,
      });
    });

    return () => {
      active = false;
    };
  }, [batch, canQuery, department, semesters]);

  return (
    <div className="p-5 flex flex-col gap-4">
      <p className="text-base font-bold text-[var(--foreground)] mb-0">
        Semester snapshot
      </p>
      {summary.loading && (
        <p className="text-sm text-[var(--muted)] m-0">Refreshing summary...</p>
      )}
      {summary.error && (
        <p className="text-sm text-red-700 font-semibold m-0">
          {summary.error}
        </p>
      )}
      {summary.data && (
        <div className="grid grid-cols-3 gap-3">
          <div className="border border-dashed border-[#c6ceef] rounded-[10px] bg-[#f7f9ff] px-3 py-2.5">
            <strong className="block text-[0.73rem] uppercase tracking-[0.05em] font-[650] text-[var(--muted)]">
              One arrear
            </strong>
            <p className="m-0 mt-1 text-[1.2rem] font-bold text-[var(--foreground)]">
              {fmtNumber(summary.data.summary.one_arrear)}
            </p>
          </div>
          <div className="border border-dashed border-[#c6ceef] rounded-[10px] bg-[#f7f9ff] px-3 py-2.5">
            <strong className="block text-[0.73rem] uppercase tracking-[0.05em] font-[650] text-[var(--muted)]">
              Two arrears
            </strong>
            <p className="m-0 mt-1 text-[1.2rem] font-bold text-[var(--foreground)]">
              {fmtNumber(summary.data.summary.two_arrears)}
            </p>
          </div>
          <div className="border border-dashed border-[#c6ceef] rounded-[10px] bg-[#f7f9ff] px-3 py-2.5">
            <strong className="block text-[0.73rem] uppercase tracking-[0.05em] font-[650] text-[var(--muted)]">
              Three+ arrears
            </strong>
            <p className="m-0 mt-1 text-[1.2rem] font-bold text-[var(--foreground)]">
              {fmtNumber(summary.data.summary["three+_arrears"])}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="border border-[#dbe3ff] rounded-[14px] bg-[#f9fbff] p-4 flex flex-col gap-2">
          <div>
            <h3 className="m-0 text-[1rem] font-bold text-[var(--foreground)]">
              Pass Percentage Trend
            </h3>
            <p className="m-0 text-[0.78rem] text-slate-500">
              Semester-wise pass performance across all available result sets.
            </p>
          </div>

          {trends.loading && (
            <p className="text-sm text-[var(--muted)] m-0">
              Loading trend data...
            </p>
          )}
          {!trends.loading && trends.data && (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trends.data}
                  margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid {...gridProps} />
                  <XAxis
                    dataKey="semester"
                    {...axisProps}
                    tickFormatter={(value) => `S${value}`}
                  />
                  <YAxis
                    {...axisProps}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    formatter={(value) =>
                      typeof value === "number"
                        ? `${value.toFixed(2)}%`
                        : String(value)
                    }
                    labelFormatter={(label) => `Semester ${String(label)}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="passPercentage"
                    name="Pass %"
                    stroke="#3040a0"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#3040a0" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {trends.error && (
            <p className="text-xs text-red-700 m-0">{trends.error}</p>
          )}
        </section>

        <section className="border border-[#dbe3ff] rounded-[14px] bg-[#f9fbff] p-4 flex flex-col gap-2">
          <div>
            <h3 className="m-0 text-[1rem] font-bold text-[var(--foreground)]">
              Arrear Distribution Trend
            </h3>
            <p className="m-0 text-[0.78rem] text-slate-500">
              Stacked arrear counts (1, 2, and 3+) by semester.
            </p>
          </div>

          {trends.loading && (
            <p className="text-sm text-[var(--muted)] m-0">
              Loading distribution data...
            </p>
          )}
          {!trends.loading && trends.data && (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={trends.data}
                  margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid {...gridProps} />
                  <XAxis
                    dataKey="semester"
                    {...axisProps}
                    tickFormatter={(value) => `S${value}`}
                  />
                  <YAxis {...axisProps} />
                  <Tooltip
                    labelFormatter={(label) => `Semester ${String(label)}`}
                  />
                  <Legend />
                  <Bar
                    dataKey="oneArrear"
                    name="1 Arrear"
                    stackId="arrears"
                    fill="#3040a0"
                  />
                  <Bar
                    dataKey="twoArrears"
                    name="2 Arrears"
                    stackId="arrears"
                    fill="#22a07a"
                  />
                  <Bar
                    dataKey="threePlusArrears"
                    name="3+ Arrears"
                    stackId="arrears"
                    fill="#e55381"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {trends.error && (
            <p className="text-xs text-red-700 m-0">{trends.error}</p>
          )}
        </section>
      </div>
    </div>
  );
}
