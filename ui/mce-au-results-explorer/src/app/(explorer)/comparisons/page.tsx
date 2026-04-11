"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Select from "react-select";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { api, type CgpaBreakdownResponse } from "../../../lib/api";
import { useExplorer } from "../../_explorer/context";
import { initialDataState, type DataState, type StudentOption } from "../../_explorer/types";
import { fmtMaybe } from "../../_explorer/utils";
import {
  btnPrimary,
  Notice,
  ScrollTable,
  SectionBlock,
  SectionHead,
  Td,
  trHover,
} from "../../_explorer/components";
import { CHART_COLORS, GRID_STROKE, axisProps, gridProps } from "../../_explorer/chartTheme";

// ── Types ──────────────────────────────────────────────────────────────────

type StuRow = {
  regno: string;
  name: string;
  sgpaPerSem: Record<string, number | null>;
  cgpa: number | null;
  arrears: number;
  credits: number;
};

type SubjRow = {
  code: string;
  name: string;
  credit: number;
  gpPerStudent: (number | null)[];
  spread: number;
};

type CompResult = {
  students: StuRow[];
  semesters: number[];
  subjectsBySession: { semester: number; rows: SubjRow[] }[];
  // chart data
  sgpaTrend: Record<string, string | number | null>[];
  cgpaTrend: Record<string, string | number | null>[];
  radarData: Record<string, string | number | null>[];
};

// ── Build comparison from breakdowns ──────────────────────────────────────

function buildComparison(
  breakdowns: CgpaBreakdownResponse[],
  selectedSemesters: number[],
): CompResult {
  const students: StuRow[] = breakdowns.map((bd) => ({
    regno: bd.regno,
    name: bd.name,
    sgpaPerSem: Object.fromEntries(
      selectedSemesters.map((sem) => {
        const s = bd.semesters.find((x) => x.semester === sem);
        return [String(sem), s?.totals.sgpa ?? null];
      }),
    ),
    cgpa: bd.overall.cgpa,
    arrears: bd.overall.arrears,
    credits: bd.overall.credits,
  }));

  // SGPA trend: one point per semester, one key per student
  const sgpaTrend = selectedSemesters.map((sem) => {
    const pt: Record<string, string | number | null> = { label: `Sem ${sem}` };
    breakdowns.forEach((bd) => {
      const s = bd.semesters.find((x) => x.semester === sem);
      pt[bd.regno] = s?.totals.sgpa ?? null;
    });
    return pt;
  });

  // CGPA trend: cumulative across semesters
  const cgpaTrend = selectedSemesters.map((sem, idx) => {
    const pt: Record<string, string | number | null> = { label: `Sem ${sem}` };
    breakdowns.forEach((bd) => {
      let runCredits = 0;
      let runGP = 0;
      for (let i = 0; i <= idx; i++) {
        const s = bd.semesters.find((x) => x.semester === selectedSemesters[i]);
        if (s) {
          runCredits += s.totals.credits;
          runGP += s.totals.grade_points;
        }
      }
      pt[bd.regno] = runCredits > 0 ? Math.round((runGP / runCredits) * 100) / 100 : null;
    });
    return pt;
  });

  // Radar data: per-semester SGPA for spider chart overlay
  const radarData = selectedSemesters.map((sem) => {
    const pt: Record<string, string | number | null> = { subject: `S${sem}` };
    breakdowns.forEach((bd) => {
      const s = bd.semesters.find((x) => x.semester === sem);
      pt[bd.regno] = s?.totals.sgpa ?? 0;
    });
    return pt;
  });

  // Subject breakdown
  const subjectsBySession = selectedSemesters.map((sem) => {
    const codeMap = new Map<string, { name: string; credit: number }>();
    for (const bd of breakdowns) {
      const sd = bd.semesters.find((x) => x.semester === sem);
      if (!sd) continue;
      for (const subj of sd.subjects)
        if (!codeMap.has(subj.code)) codeMap.set(subj.code, { name: subj.name, credit: subj.credit });
    }
    const rows: SubjRow[] = Array.from(codeMap.entries()).map(([code, { name, credit }]) => {
      const gpPerStudent = breakdowns.map((bd) => {
        const sd = bd.semesters.find((x) => x.semester === sem);
        return sd?.subjects.find((s) => s.code === code)?.gp ?? null;
      });
      const valid = gpPerStudent.filter((g): g is number => g !== null);
      const spread = valid.length > 1 ? Math.max(...valid) - Math.min(...valid) : 0;
      return { code, name, credit, gpPerStudent, spread };
    });
    rows.sort((a, b) => a.code.localeCompare(b.code));
    return { semester: sem, rows };
  });

  return { students, semesters: selectedSemesters, subjectsBySession, sgpaTrend, cgpaTrend, radarData };
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ComparisonsPage() {
  const { canQuery, semesters, department, batch, studentsDirectory } = useExplorer();

  const portalRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { portalRef.current = document.body; setMounted(true); }, []);
  const rsShared = {
    classNamePrefix: "rs" as const,
    menuPortalTarget: mounted ? portalRef.current! : undefined,
    styles: { menuPortal: (base: object) => ({ ...base, zIndex: 9999 }) },
  } as const;

  const [selectedStudents, setSelectedStudents] = useState<StudentOption[]>([]);
  const [comparison, setComparison] = useState<DataState<CompResult>>(initialDataState);

  const studentOptions = useMemo<StudentOption[]>(
    () =>
      (studentsDirectory.data ?? []).map((item) => ({
        value: item.regno,
        label: `${item.name} (${item.regno})`,
      })),
    [studentsDirectory.data],
  );

  const semLabel = semesters.length > 0
    ? [...semesters].sort((a, b) => a - b).map((s) => `S${s}`).join(", ")
    : "none selected";

  const onCompare = async (e: FormEvent) => {
    e.preventDefault();
    if (!canQuery) return;
    if (selectedStudents.length < 2) {
      setComparison({ loading: false, error: "Select at least 2 students.", data: null });
      return;
    }
    if (selectedStudents.length > 12) {
      setComparison({ loading: false, error: "Comparison supports up to 12 students.", data: null });
      return;
    }
    if (semesters.length === 0) {
      setComparison({ loading: false, error: "Select semesters in the filter bar.", data: null });
      return;
    }
    setComparison({ loading: true, error: null, data: null });
    try {
      const sorted = [...semesters].sort((a, b) => a - b);
      const semStr = sorted.join(",");
      const breakdowns = await Promise.all(
        selectedStudents.map((stu) =>
          api.getCgpaBreakdown({ semesters: semStr, department, batch: batch || null, regno: stu.value }),
        ),
      );
      setComparison({ loading: false, error: null, data: buildComparison(breakdowns, sorted) });
    } catch (err) {
      setComparison({
        loading: false,
        error: err instanceof Error ? err.message : "Comparison failed",
        data: null,
      });
    }
  };

  const result = comparison.data;

  return (
    <div className="p-4 flex flex-col gap-4 overflow-auto max-h-[calc(100vh-150px)]">
      {!canQuery && <Notice>Select department and semester to run comparisons.</Notice>}

      <SectionBlock>
        <SectionHead
          title="Multi-Student Comparison"
          description="CGPA across semesters + subject grade-point spread per semester."
        />

        <div className="flex items-center gap-2 text-[0.78rem] text-[var(--muted)]">
          <span className="font-bold uppercase tracking-[0.04em]">Comparing semesters:</span>
          <span className="font-mono font-semibold text-[var(--foreground)]">{semLabel}</span>
          <span className="text-slate-400 text-xs">(change in the filter bar above)</span>
        </div>

        <form onSubmit={onCompare} className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="cmp-students"
              className="text-[0.72rem] uppercase tracking-[0.04em] font-[650] text-[var(--muted)]"
            >
              Students (2–12)
            </label>
            <Select<StudentOption, true>
              {...rsShared}
              inputId="cmp-students"
              isMulti
              options={studentOptions}
              value={selectedStudents}
              onChange={(opts) => setSelectedStudents([...opts])}
              isLoading={studentsDirectory.loading}
              placeholder="Search and select students…"
            />
            <p className="text-xs text-slate-500 m-0">
              {studentOptions.length} students in directory · {selectedStudents.length} selected
            </p>
          </div>

          <button
            type="submit"
            disabled={comparison.loading || !canQuery}
            className={`${btnPrimary} self-start`}
          >
            {comparison.loading ? "Comparing…" : "Compare Students"}
          </button>
        </form>

        {comparison.error && <Notice error>{comparison.error}</Notice>}

        {result && (
          <div className="flex flex-col gap-5">
            {/* ── Overlaid SGPA trend ─────────────────────────────────── */}
            <div className="flex flex-col gap-1">
              <p className="text-[0.82rem] font-bold text-[var(--foreground)] m-0 uppercase tracking-[0.04em]">
                SGPA Trend Overlay
              </p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.sgpaTrend} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis {...axisProps} domain={[0, 10]} />
                    <Tooltip
                        formatter={(v: any) => (v != null ? Number(v).toFixed(2) : "–")}
                      contentStyle={{ borderRadius: 10, border: `1px solid ${GRID_STROKE}`, fontSize: 13 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {result.students.map((stu, i) => (
                      <Line
                        key={stu.regno}
                        dataKey={stu.regno}
                        name={`${stu.name.split(" ")[0]} (${stu.regno.slice(-4)})`}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Overlaid CGPA trend ─────────────────────────────────── */}
            <div className="flex flex-col gap-1">
              <p className="text-[0.82rem] font-bold text-[var(--foreground)] m-0 uppercase tracking-[0.04em]">
                Cumulative CGPA Trend
              </p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.cgpaTrend} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis {...axisProps} domain={[0, 10]} />
                    <Tooltip
                        formatter={(v: any) => (v != null ? Number(v).toFixed(2) : "–")}
                      contentStyle={{ borderRadius: 10, border: `1px solid ${GRID_STROKE}`, fontSize: 13 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {result.students.map((stu, i) => (
                      <Line
                        key={stu.regno}
                        dataKey={stu.regno}
                        name={`${stu.name.split(" ")[0]} (${stu.regno.slice(-4)})`}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        strokeWidth={2}
                        strokeDasharray="6 3"
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Radar Chart ────────────────────────────────────────── */}
            {result.radarData.length >= 3 && (
              <div className="flex flex-col gap-1">
                <p className="text-[0.82rem] font-bold text-[var(--foreground)] m-0 uppercase tracking-[0.04em]">
                  Performance Radar
                </p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={result.radarData} outerRadius="70%">
                      <PolarGrid stroke={GRID_STROKE} />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#6b7bb8" }} />
                      <PolarRadiusAxis
                        domain={[0, 10]}
                        tick={{ fontSize: 10, fill: "#aaa" }}
                        tickCount={6}
                      />
                      <Tooltip
                          formatter={(v: any) => (v != null ? Number(v).toFixed(2) : "–")}
                        contentStyle={{ borderRadius: 10, border: `1px solid ${GRID_STROKE}`, fontSize: 13 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {result.students.map((stu, i) => (
                        <Radar
                          key={stu.regno}
                          name={`${stu.name.split(" ")[0]} (${stu.regno.slice(-4)})`}
                          dataKey={stu.regno}
                          stroke={CHART_COLORS[i % CHART_COLORS.length]}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                          fillOpacity={0.08}
                          strokeWidth={2}
                        />
                      ))}
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── CGPA Summary Table ─────────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <p className="text-[0.82rem] font-bold text-[var(--foreground)] m-0 uppercase tracking-[0.04em]">
                CGPA Summary
              </p>
              <ScrollTable
                maxH="max-h-72"
                cols={[
                  "Name",
                  "RegNo",
                  ...result.semesters.map((s) => `S${s} SGPA`),
                  "CGPA",
                  "Arrears",
                  "Credits",
                ]}
              >
                {result.students.map((stu) => (
                  <tr key={stu.regno} className={trHover}>
                    <Td>{stu.name}</Td>
                    <Td>{stu.regno}</Td>
                    {result.semesters.map((sem) => (
                      <Td key={sem}>{fmtMaybe(stu.sgpaPerSem[String(sem)])}</Td>
                    ))}
                    <Td className={stu.cgpa != null ? "font-semibold" : ""}>
                      {fmtMaybe(stu.cgpa)}
                    </Td>
                    <Td className={stu.arrears > 0 ? "text-amber-700 font-semibold" : ""}>
                      {stu.arrears}
                    </Td>
                    <Td>{stu.credits.toFixed(1)}</Td>
                  </tr>
                ))}
              </ScrollTable>
            </div>

            {/* ── Subject breakdown per semester ──────────────────────── */}
            {result.subjectsBySession.map(({ semester: sem, rows }) => (
              <div key={`sem-${sem}`} className="flex flex-col gap-1.5">
                <p className="text-[0.82rem] font-bold text-[var(--foreground)] m-0 uppercase tracking-[0.04em]">
                  Semester {sem} — Subject Grade Points
                </p>
                {rows.length === 0 ? (
                  <p className="text-xs text-slate-500 m-0">No subject data for this semester.</p>
                ) : (
                  <ScrollTable
                    maxH="max-h-64"
                    cols={[
                      "Code", "Subject", "Credit",
                      ...result.students.map((s) => s.regno.slice(-4)),
                      "Spread",
                    ]}
                  >
                    {rows.map((row) => {
                      const maxGp = Math.max(...row.gpPerStudent.filter((g): g is number => g !== null));
                      return (
                        <tr key={row.code} className={trHover}>
                          <Td>{row.code}</Td>
                          <Td>{row.name}</Td>
                          <Td>{row.credit.toFixed(1)}</Td>
                          {row.gpPerStudent.map((gp, i) => {
                            const isTop = gp === maxGp && row.spread > 0;
                            const isLow = gp !== null && gp < maxGp;
                            return (
                              <Td
                                key={i}
                                className={
                                  isTop ? "text-green-800 font-semibold"
                                    : isLow ? "text-amber-700"
                                    : "text-slate-500"
                                }
                              >
                                {gp ?? "–"}
                              </Td>
                            );
                          })}
                          <Td className={row.spread > 0 ? "text-sky-700 font-semibold" : "text-slate-400"}>
                            {row.spread > 0 ? `+${row.spread}` : "–"}
                          </Td>
                        </tr>
                      );
                    })}
                  </ScrollTable>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionBlock>
    </div>
  );
}
