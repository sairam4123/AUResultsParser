"use client";

import { useEffect, useMemo, useState } from "react";
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
import { api, type CgpaClassResponse } from "../../../lib/api";
import { axisProps, gridProps } from "../../_explorer/chartTheme";
import { useExplorer } from "../../_explorer/context";
import { initialDataState, type DataState } from "../../_explorer/types";
import { fmtNumber } from "../../_explorer/utils";

type HistogramPoint = {
  label: string;
  min: number;
  max: number;
  count: number;
  color: string;
};

type RankingsAnalytics = {
  sampleSize: number;
  min: number;
  max: number;
  median: number;
  stdDev: number;
  histogram: HistogramPoint[];
};

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

export default function RankingsPage() {
  const {
    ranks,
    canQuery,
    semester,
    department,
    batch,
    selectedSemesters,
    topK,
  } = useExplorer();
  const [analytics, setAnalytics] =
    useState<DataState<RankingsAnalytics>>(initialDataState);
  const [cgpaClass, setCgpaClass] =
    useState<DataState<CgpaClassResponse>>(initialDataState);

  const rankingSemestersCsv = useMemo(() => {
    if (selectedSemesters.length > 0) {
      return [...selectedSemesters].sort((a, b) => a - b).join(",");
    }
    return String(semester);
  }, [selectedSemesters, semester]);

  useEffect(() => {
    if (!canQuery || semester <= 0) {
      setAnalytics(initialDataState);
      return;
    }

    if (ranks.loading) {
      setAnalytics({ loading: true, error: null, data: null });
      return;
    }

    if (ranks.error || !ranks.data) {
      setAnalytics({
        loading: false,
        error: ranks.error ?? "No ranking data available.",
        data: null,
      });
      return;
    }

    const sgpas = ranks.data.items
      .map((item) => item.sgpa)
      .filter(
        (value): value is number => value != null && Number.isFinite(value),
      );

    if (sgpas.length === 0) {
      setAnalytics({
        loading: false,
        error: "No SGPA values available for distribution.",
        data: null,
      });
      return;
    }

    const min = Math.min(...sgpas);
    const max = Math.max(...sgpas);
    const mean = sgpas.reduce((sum, value) => sum + value, 0) / sgpas.length;
    const variance =
      sgpas.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      Math.max(sgpas.length - 1, 1);

    const bucketDefs = [
      { min: 0, max: 5, label: "0.00-4.99", color: "#ef4444" },
      { min: 5, max: 6, label: "5.00-5.99", color: "#f97316" },
      { min: 6, max: 7, label: "6.00-6.99", color: "#f59e0b" },
      { min: 7, max: 8, label: "7.00-7.99", color: "#84cc16" },
      { min: 8, max: 9, label: "8.00-8.99", color: "#22a07a" },
      { min: 9, max: 10.01, label: "9.00-10.00", color: "#3040a0" },
    ];

    const histogram = bucketDefs.map((bucket) => ({
      ...bucket,
      count: sgpas.filter((value) => value >= bucket.min && value < bucket.max)
        .length,
    }));

    setAnalytics({
      loading: false,
      error: null,
      data: {
        sampleSize: sgpas.length,
        min,
        max,
        median: percentile(sgpas, 0.5),
        stdDev: Math.sqrt(variance),
        histogram,
      },
    });
  }, [canQuery, ranks.data, ranks.error, ranks.loading, semester]);

  useEffect(() => {
    if (!canQuery) {
      setCgpaClass(initialDataState);
      return;
    }

    let active = true;
    setCgpaClass({ loading: true, error: null, data: null });

    void api
      .getCgpaClass({
        semesters: rankingSemestersCsv,
        department,
        batch: batch || null,
        sortBy: "cgpa",
        top: topK,
      })
      .then((payload) => {
        if (!active) {
          return;
        }
        setCgpaClass({ loading: false, error: null, data: payload });
      })
      .catch((error: Error) => {
        if (!active) {
          return;
        }
        setCgpaClass({ loading: false, error: error.message, data: null });
      });

    return () => {
      active = false;
    };
  }, [batch, canQuery, department, rankingSemestersCsv, topK]);

  const cgpaDistribution = useMemo(() => {
    if (!cgpaClass.data) {
      return [] as HistogramPoint[];
    }

    const cgpas = cgpaClass.data.rows
      .map((row) => row.cgpa)
      .filter(
        (value): value is number => value != null && Number.isFinite(value),
      );

    if (cgpas.length === 0) {
      return [] as HistogramPoint[];
    }

    const bucketDefs = [
      { min: 0, max: 5, label: "0.00-4.99", color: "#ef4444" },
      { min: 5, max: 6, label: "5.00-5.99", color: "#f97316" },
      { min: 6, max: 7, label: "6.00-6.99", color: "#f59e0b" },
      { min: 7, max: 8, label: "7.00-7.99", color: "#84cc16" },
      { min: 8, max: 9, label: "8.00-8.99", color: "#22a07a" },
      { min: 9, max: 10.01, label: "9.00-10.00", color: "#3040a0" },
    ];

    return bucketDefs.map((bucket) => ({
      ...bucket,
      count: cgpas.filter((value) => value >= bucket.min && value < bucket.max)
        .length,
    }));
  }, [cgpaClass.data]);

  const statsTiles = useMemo(() => {
    if (!analytics.data) return [];
    return [
      { label: "Min", value: analytics.data.min.toFixed(2) },
      { label: "Max", value: analytics.data.max.toFixed(2) },
      { label: "Median", value: analytics.data.median.toFixed(2) },
      { label: "Std Dev", value: analytics.data.stdDev.toFixed(2) },
      { label: "Sample", value: String(analytics.data.sampleSize) },
    ];
  }, [analytics.data]);

  return (
    <div className="p-4 overflow-auto max-h-[calc(100vh-180px)] flex flex-col gap-4">
      <section className="border border-[#dbe3ff] rounded-[14px] bg-[#f9fbff] p-4 flex flex-col gap-3">
        <div>
          <h3 className="m-0 text-[1rem] font-bold text-[var(--foreground)]">
            SGPA Distribution Histogram
          </h3>
          <p className="m-0 text-[0.8rem] text-slate-500">
            Color-coded bucket view with descriptive statistics for semester{" "}
            {semester}. Based on current Top K ({topK}).
          </p>
        </div>

        {analytics.loading && (
          <p className="text-sm text-[var(--muted)] m-0">
            Computing distribution...
          </p>
        )}
        {analytics.error && (
          <p className="text-sm text-red-700 font-semibold m-0">
            {analytics.error}
          </p>
        )}

        {statsTiles.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {statsTiles.map((item) => (
              <div
                key={item.label}
                className="border border-dashed border-[#c6ceef] rounded-[10px] bg-[#f7f9ff] px-3 py-2.5"
              >
                <strong className="block text-[0.68rem] uppercase tracking-[0.04em] font-[650] text-[var(--muted)]">
                  {item.label}
                </strong>
                <p className="m-0 mt-1 text-[1.05rem] font-bold text-[var(--foreground)]">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {!analytics.loading && analytics.data && (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analytics.data.histogram}
                margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip
                  formatter={(value) => [String(value ?? "0"), "Students"]}
                  labelFormatter={(label) => `SGPA ${String(label)}`}
                />
                <Bar dataKey="count" name="Students" radius={[6, 6, 0, 0]}>
                  {analytics.data.histogram.map((bucket) => (
                    <Cell key={bucket.label} fill={bucket.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="border border-[#dbe3ff] rounded-[14px] bg-[#f9fbff] p-4 flex flex-col gap-3">
        <div>
          <h3 className="m-0 text-[1rem] font-bold text-[var(--foreground)]">
            CGPA Distribution Histogram
          </h3>
          <p className="m-0 text-[0.8rem] text-slate-500">
            Distribution of CGPA ranks for selected semesters (Top K {topK}).
          </p>
        </div>

        {cgpaClass.loading && (
          <p className="text-sm text-[var(--muted)] m-0">
            Loading CGPA distribution...
          </p>
        )}
        {!cgpaClass.loading && cgpaDistribution.length === 0 && (
          <p className="text-sm text-[var(--muted)] m-0">
            No CGPA values available for distribution.
          </p>
        )}

        {!cgpaClass.loading && cgpaDistribution.length > 0 && (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={cgpaDistribution}
                margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip
                  formatter={(value) => [String(value ?? "0"), "Students"]}
                  labelFormatter={(label) => `CGPA ${String(label)}`}
                />
                <Bar dataKey="count" name="Students" radius={[6, 6, 0, 0]}>
                  {cgpaDistribution.map((bucket) => (
                    <Cell key={`cgpa-${bucket.label}`} fill={bucket.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {ranks.loading && (
        <p className="text-sm text-[var(--muted)] m-0">Loading rank list...</p>
      )}
      {ranks.error && (
        <p className="text-sm text-red-700 font-semibold m-0">{ranks.error}</p>
      )}
      {ranks.data && (
        <table className="w-full border-collapse overflow-hidden rounded-[10px]">
          <thead className="bg-[#eef2ff]">
            <tr>
              {["Rank", "Register No", "Name", "SGPA"].map((h) => (
                <th
                  key={h}
                  className="px-2.5 py-2 text-left text-[0.76rem] uppercase tracking-[0.04em] font-bold text-[var(--muted)] border-b border-[#dbe3ff]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranks.data.items.map((item) => (
              <tr
                key={item.regno}
                className="hover:bg-[#f4f7ff] transition-colors"
              >
                <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                  {item.rank}
                </td>
                <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                  {item.regno}
                </td>
                <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                  {item.name}
                </td>
                <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                  {fmtNumber(item.sgpa)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section className="border border-[#dbe3ff] rounded-[14px] bg-[#f9fbff] p-4 flex flex-col gap-3">
        <div>
          <h3 className="m-0 text-[1rem] font-bold text-[var(--foreground)]">
            Class CGPA Ranking
          </h3>
          <p className="m-0 text-[0.8rem] text-slate-500">
            Combined ranking across selected semesters.
          </p>
        </div>

        {cgpaClass.loading && (
          <p className="text-sm text-[var(--muted)] m-0">
            Loading class CGPA ranking...
          </p>
        )}
        {cgpaClass.error && (
          <p className="text-sm text-red-700 font-semibold m-0">
            {cgpaClass.error}
          </p>
        )}

        {cgpaClass.data && (
          <div className="overflow-auto border border-[#dbe3ff] rounded-[10px]">
            <table className="w-full border-collapse">
              <thead className="bg-[#eef2ff]">
                <tr>
                  {[
                    "Rank",
                    "Register No",
                    "Name",
                    "CGPA",
                    "Arrears",
                    "Credits",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-2.5 py-2 text-left text-[0.76rem] uppercase tracking-[0.04em] font-bold text-[var(--muted)] border-b border-[#dbe3ff]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cgpaClass.data.rows.map((item, index) => (
                  <tr
                    key={item.regno}
                    className="hover:bg-[#f4f7ff] transition-colors"
                  >
                    <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                      {index + 1}
                    </td>
                    <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                      {item.regno}
                    </td>
                    <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                      {item.name}
                    </td>
                    <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                      {item.cgpa == null ? "-" : item.cgpa.toFixed(2)}
                    </td>
                    <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                      {item.arrears}
                    </td>
                    <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                      {item.credits.toFixed(1)}
                    </td>
                  </tr>
                ))}
                {cgpaClass.data.rows.length === 0 && (
                  <tr>
                    <td
                      className="px-2.5 py-3 text-sm text-center text-[var(--muted)]"
                      colSpan={6}
                    >
                      No CGPA records for selected semesters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
