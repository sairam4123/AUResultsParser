"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, type FormEvent, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { api, type CgpaBreakdownResponse, type StudentResponse } from "../../../lib/api";
import { useExplorer } from "../../_explorer/context";
import { initialDataState, type DataState } from "../../_explorer/types";
import { fmtMaybe, fmtNumber, parseSemestersInput } from "../../_explorer/utils";
import {
  btnPrimary,
  btnSecondary,
  InputField,
  inputCls,
  Notice,
  ResultBlock,
  ScrollTable,
  SectionBlock,
  SectionHead,
  StatTile,
  Td,
  trHover,
} from "../../_explorer/components";
import { CHART_COLORS, GRID_STROKE, axisProps, gridProps } from "../../_explorer/chartTheme";

const gradePointMap: Record<string, number> = {
  O: 10, "A+": 9, A: 8, "B+": 7, B: 6, C: 5, U: 0, UA: 0, NA: 0, NC: 0,
};

type TrendPoint = {
  label: string;
  sgpa: number | null;
  cgpa: number | null;
  arrears: number;
};

function StudentPageContent() {
  const { canQuery, semester, semesters, department, batch } = useExplorer();
  const searchParams = useSearchParams();

  const [regnoInput, setRegnoInput] = useState(
    () => searchParams.get("regno")?.trim() ?? "",
  );
  const [student, setStudent] = useState<DataState<StudentResponse>>(initialDataState);

  const [cgpaBreakdown, setCgpaBreakdown] =
    useState<DataState<CgpaBreakdownResponse>>(initialDataState);

  const [autoLoaded, setAutoLoaded] = useState(false);
  useEffect(() => {
    const regno = searchParams.get("regno")?.trim();
    if (regno && canQuery && !autoLoaded) {
      setAutoLoaded(true);
      void loadStudent(regno);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canQuery]);

  // ── Build SGPA/CGPA trend data from breakdown ────────────────────────────

  const trendData = useMemo<TrendPoint[]>(() => {
    if (!cgpaBreakdown.data?.semesters.length) return [];

    const sorted = [...cgpaBreakdown.data.semesters].sort((a, b) => a.semester - b.semester);
    let runCredits = 0;
    let runGP = 0;

    return sorted.map((s) => {
      runCredits += s.totals.credits;
      runGP += s.totals.grade_points;
      const cgpa = runCredits > 0 ? runGP / runCredits : null;
      return {
        label: `Sem ${s.semester}`,
        sgpa: s.totals.sgpa,
        cgpa,
        arrears: s.totals.arrears,
      };
    });
  }, [cgpaBreakdown.data]);

  const loadStudent = async (rawRegno: string) => {
    if (!canQuery) return;
    const regno = rawRegno.trim();
    if (!regno) {
      setStudent({ loading: false, error: "Enter a register number.", data: null });
      return;
    }
    
    setStudent({ loading: true, error: null, data: null });
    setCgpaBreakdown({ loading: true, error: null, data: null });
    
    try {
      const studentP = api.getStudent(semester, department, batch || null, regno);
      const sortedSemesters = [...semesters].sort((a, b) => a - b).join(",");
      const cgpaP = sortedSemesters.length > 0
        ? api.getCgpaBreakdown({ semesters: sortedSemesters, department, batch: batch || null, regno })
        : Promise.resolve(null);

      const [studentData, cgpaData] = await Promise.all([studentP, cgpaP]);
      
      setStudent({ loading: false, error: null, data: studentData });
      
      if (cgpaData) {
        setCgpaBreakdown({ loading: false, error: null, data: cgpaData });
      } else {
        setCgpaBreakdown({ loading: false, error: "No semesters selected for CGPA calculation.", data: null });
      }
    } catch (err) {
      setStudent({
        loading: false,
        error: err instanceof Error ? err.message : "Lookup failed",
        data: null,
      });
      setCgpaBreakdown({
        loading: false,
        error: "Failed to load CGPA breakdown",
        data: null,
      });
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void loadStudent(regnoInput);
  };

  return (
    <div className="p-4 overflow-auto max-h-[calc(100vh-150px)] flex flex-col gap-4">
      {/* ── Lookup ────────────────────────────────────────────────────── */}
      <form className="flex items-end gap-2.5" onSubmit={onSubmit}>
        <input
          type="text"
          placeholder="Enter register number"
          value={regnoInput}
          onChange={(e) => setRegnoInput(e.target.value)}
          className={`${inputCls} flex-1`}
        />
        <button type="submit" disabled={!canQuery} className={`${btnPrimary} shrink-0`}>
          Look Up
        </button>
      </form>

      {!canQuery && <Notice>Select department and semester to query student data.</Notice>}
      {student.loading && <Notice>Loading student profile…</Notice>}
      {student.error && <Notice error>{student.error}</Notice>}

      {student.data && (
        <>
          {/* Profile header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[var(--panel-border)] rounded-[12px] bg-[#f7f9ff] px-5 py-4">
            <div>
              <h3 className="m-0 mb-1 text-[1.4rem] font-bold text-[var(--foreground)]">
                {student.data.student.name}
              </h3>
              <p className="m-0 text-[0.95rem] text-[var(--muted)] font-mono">
                {student.data.student.regno}
                {student.data.student.sgpa != null && (
                  <> · Sem {semester} SGPA <strong>{fmtNumber(student.data.student.sgpa)}</strong></>
                )}
                {student.data.student.rank != null && (
                  <> · Rank <strong>{student.data.student.rank}</strong></>
                )}
              </p>
            </div>

            {cgpaBreakdown.loading && (
              <div className="text-[0.8rem] text-[var(--muted)] animate-pulse">Calculating CGPA...</div>
            )}

            {cgpaBreakdown.data && (
              <div className="flex items-center gap-6 text-right shrink-0">
                <div className="flex flex-col">
                  <p className="m-0 text-[0.7rem] uppercase tracking-[0.08em] font-bold text-[var(--muted)] mb-1">
                    Total Arrears
                  </p>
                  <p
                    className={`m-0 text-[2rem] font-extrabold leading-none ${
                        cgpaBreakdown.data.overall.arrears > 0 ? "text-red-500" : "text-green-500"
                    }`}
                  >
                    {cgpaBreakdown.data.overall.arrears}
                  </p>
                </div>
                <div className="w-[1px] h-10 bg-slate-200" />
                <div className="flex flex-col">
                  <p className="m-0 text-[0.7rem] uppercase tracking-[0.08em] font-bold text-[var(--muted)] mb-1">
                    Overall CGPA
                  </p>
                  <p className="m-0 text-[2rem] font-extrabold text-[var(--foreground)] leading-none">
                    {fmtMaybe(cgpaBreakdown.data.overall.cgpa)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Current semester subjects */}
          <ResultBlock title={`Semester ${semester} — Subject Snapshot`}>
            <ScrollTable cols={["Code", "Subject", "Grade", "Status", "GP"]}>
              {student.data.student.subjects.map((item) => (
                <tr key={item.code} className={trHover}>
                  <Td>{item.code}</Td>
                  <Td>{item.name}</Td>
                  <Td>{item.grade}</Td>
                  <Td>{item.status}</Td>
                  <Td>{gradePointMap[item.grade] ?? 0}</Td>
                </tr>
              ))}
            </ScrollTable>
          </ResultBlock>

          {/* ── CGPA Breakdown + charts ───────────────────────────────── */}
          <SectionBlock>
            <SectionHead
              title="CGPA Breakdown"
              description="Semester-wise and subject-wise calculations based on globally selected semesters."
            />

            {cgpaBreakdown.error && <Notice error>{cgpaBreakdown.error}</Notice>}

            {cgpaBreakdown.data && (
              <div className="flex flex-col gap-4">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 max-w-[400px]">
                  <StatTile label="Total Credits" value={cgpaBreakdown.data.overall.credits.toFixed(1)} />
                  <StatTile label="Total Grade Points" value={cgpaBreakdown.data.overall.grade_points.toFixed(2)} />
                </div>

                {/* ── SGPA & CGPA Trend Chart ──────────────────────────── */}
                {trendData.length > 1 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-[0.78rem] font-bold text-[var(--foreground)] m-0 uppercase tracking-[0.04em]">
                      SGPA & CGPA Trend
                    </p>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
                          <CartesianGrid {...gridProps} />
                          <XAxis dataKey="label" {...axisProps} />
                          <YAxis {...axisProps} domain={[0, 10]} />
                          <Tooltip
                            formatter={(v: any) => v != null ? Number(v).toFixed(2) : "–"}
                            contentStyle={{ borderRadius: 10, border: `1px solid ${GRID_STROKE}`, fontSize: 13 }}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Line
                            type="monotone"
                            dataKey="sgpa"
                            name="SGPA"
                            stroke={CHART_COLORS[0]}
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: CHART_COLORS[0] }}
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="cgpa"
                            name="CGPA (cumulative)"
                            stroke={CHART_COLORS[2]}
                            strokeWidth={2}
                            strokeDasharray="6 3"
                            dot={{ r: 3, fill: CHART_COLORS[2] }}
                            connectNulls
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* ── Arrears area chart ───────────────────────────────── */}
                {trendData.length > 1 && trendData.some((p) => p.arrears > 0) && (
                  <div className="flex flex-col gap-1">
                    <p className="text-[0.78rem] font-bold text-[var(--foreground)] m-0 uppercase tracking-[0.04em]">
                      Arrears per Semester
                    </p>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
                          <CartesianGrid {...gridProps} />
                          <XAxis dataKey="label" {...axisProps} />
                          <YAxis {...axisProps} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ borderRadius: 10, border: `1px solid ${GRID_STROKE}`, fontSize: 13 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="arrears"
                            name="Arrears"
                            stroke={CHART_COLORS[1]}
                            fill={CHART_COLORS[1]}
                            fillOpacity={0.15}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                <p className="text-sm text-slate-600 m-0">
                  Overall CGPA ={" "}
                  <strong>{cgpaBreakdown.data.overall.grade_points.toFixed(2)}</strong> /{" "}
                  <strong>{cgpaBreakdown.data.overall.credits.toFixed(1)}</strong> ={" "}
                  <strong>{fmtMaybe(cgpaBreakdown.data.overall.cgpa)}</strong>
                </p>

                {/* Per-semester summary table */}
                <ScrollTable cols={["Semester", "Credits", "Grade Points", "SGPA", "Arrears"]}>
                  {cgpaBreakdown.data.semesters.map((s) => (
                    <tr key={s.semester} className={trHover}>
                      <Td>Semester {s.semester}</Td>
                      <Td>{s.totals.credits.toFixed(1)}</Td>
                      <Td>{s.totals.grade_points.toFixed(2)}</Td>
                      <Td>{fmtMaybe(s.totals.sgpa)}</Td>
                      <Td>{s.totals.arrears}</Td>
                    </tr>
                  ))}
                </ScrollTable>

                {/* Subject detail across all semesters */}
                <div className="flex flex-col gap-6 mt-4">
                  {cgpaBreakdown.data.semesters.map((semData) => (
                    <div key={semData.semester} className="flex flex-col gap-2">
                       <p className="text-[0.85rem] text-[var(--foreground)] m-0 border-b border-[var(--panel-border)] pb-1.5 mb-1 px-1">
                        <strong>Semester {semData.semester}</strong> — SGPA:{" "}
                        <strong>{semData.totals.grade_points.toFixed(2)}</strong> /{" "}
                        <strong>{semData.totals.credits.toFixed(1)}</strong> ={" "}
                        <strong>{fmtMaybe(semData.totals.sgpa)}</strong>
                      </p>
                      <ScrollTable
                        cols={["Code", "Subject", "Grade", "Credit", "GP", "Credit × GP", "Included"]}
                      >
                        {semData.subjects.map((subj) => (
                          <tr key={subj.code} className={trHover}>
                            <Td>{subj.code}</Td>
                            <Td>{subj.name}</Td>
                            <Td>{subj.grade}</Td>
                            <Td>{subj.credit.toFixed(1)}</Td>
                            <Td>{subj.gp ?? "–"}</Td>
                            <Td>{subj.credit_x_gp.toFixed(2)}</Td>
                            <Td>
                              {subj.included ? (
                                <span className="text-green-600 font-bold">Yes</span>
                              ) : (
                                <span className="text-slate-400">No</span>
                              )}
                            </Td>
                          </tr>
                        ))}
                      </ScrollTable>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionBlock>
        </>
      )}
    </div>
  );
}

export default function StudentPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4">
          <p className="text-sm text-[var(--muted)] m-0">Loading student tools…</p>
        </div>
      }
    >
      <StudentPageContent />
    </Suspense>
  );
}
