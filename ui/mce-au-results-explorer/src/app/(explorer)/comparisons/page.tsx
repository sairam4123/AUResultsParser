"use client";

import { Fragment, type FormEvent, useMemo, useState } from "react";
import Select, { type MultiValue } from "react-select";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  api,
  type CgpaBreakdownResponse,
} from "../../../lib/api";
import { axisProps, CHART_COLORS, gridProps } from "../../_explorer/chartTheme";
import { useExplorer } from "../../_explorer/context";
import {
  initialDataState,
  type DataState,
  type StudentOption,
  type SubjectComparisonTable,
} from "../../_explorer/types";
import { buildSubjectComparisonTable } from "../../_explorer/utils";

type StudentTrendProfile = {
  regno: string;
  name: string;
  trend: {
    semester: number;
    sgpa: number | null;
    cgpa: number | null;
    arrears: number;
  }[];
  metrics: {
    cgpa: number;
    avgSgpa: number;
    bestSgpa: number;
    consistency: number;
    arrearControl: number;
  };
};

type SemesterComparisonRow = {
  semester: number;
  values: Array<{
    regno: string;
    sgpa: number | null;
    cgpa: number | null;
    arrears: number;
  }>;
};

const formatSemesterScope = (semesters: number[]) => {
  if (semesters.length === 0) {
    return "No semesters selected";
  }

  const sorted = [...semesters].sort((a, b) => a - b);
  if (sorted.length === 1) {
    return `Semester ${sorted[0]}`;
  }

  return `Semesters ${sorted[0]}-${sorted[sorted.length - 1]}`;
};

const THead = ({ cols }: { cols: string[] }) => (
  <thead className="bg-[#eef2ff]">
    <tr>
      {cols.map((col) => (
        <th
          key={col}
          className="px-2.5 py-2 text-left text-[0.74rem] uppercase tracking-[0.04em] font-bold text-[var(--muted)] border-b border-[#dbe3ff]"
        >
          {col}
        </th>
      ))}
    </tr>
  </thead>
);

const toTrendProfile = (payload: CgpaBreakdownResponse): StudentTrendProfile => {
  const semesters = [...payload.semesters].sort((a, b) => a.semester - b.semester);
  let cumulativeCredits = 0;
  let cumulativeGradePoints = 0;

  const trend = semesters.map((item) => {
    cumulativeCredits += item.totals.credits;
    cumulativeGradePoints += item.totals.grade_points;

    const cgpa =
      cumulativeCredits > 0
        ? Number((cumulativeGradePoints / cumulativeCredits).toFixed(2))
        : null;

    return {
      semester: item.semester,
      sgpa: item.totals.sgpa,
      cgpa,
      arrears: item.totals.arrears,
    };
  });

  const sgpas = trend
    .map((item) => item.sgpa)
    .filter((value): value is number => value != null && Number.isFinite(value));

  const avgSgpa =
    sgpas.length > 0
      ? sgpas.reduce((sum, value) => sum + value, 0) / sgpas.length
      : 0;
  const bestSgpa = sgpas.length > 0 ? Math.max(...sgpas) : 0;

  const mean = avgSgpa;
  const variance =
    sgpas.length > 1
      ? sgpas.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (sgpas.length - 1)
      : 0;
  const stdDev = Math.sqrt(variance);

  return {
    regno: payload.regno,
    name: payload.name,
    trend,
    metrics: {
      cgpa: payload.overall.cgpa ?? 0,
      avgSgpa,
      bestSgpa,
      consistency: Math.max(0, Number((10 - stdDev * 2).toFixed(2))),
      arrearControl: Math.max(0, Number((10 - payload.overall.arrears).toFixed(2))),
    },
  };
};

const toSelectedSemesterComparisonStudent = (
  payload: CgpaBreakdownResponse,
  selectedSemesters: number[],
) => {
  const allowedSemesters =
    selectedSemesters.length > 0 ? new Set(selectedSemesters) : null;

  const scopedSemesters = payload.semesters.filter(
    (item) => !allowedSemesters || allowedSemesters.has(item.semester),
  );

  const sgpas = scopedSemesters
    .map((item) => item.totals.sgpa)
    .filter((value): value is number => value != null && Number.isFinite(value));

  const averageSgpa =
    sgpas.length > 0
      ? Number((sgpas.reduce((sum, value) => sum + value, 0) / sgpas.length).toFixed(2))
      : 0;

  return {
    regno: payload.regno,
    name: payload.name,
    sgpa: averageSgpa,
    rank: null,
    arrears: scopedSemesters.reduce((sum, item) => sum + item.totals.arrears, 0),
    subjects: scopedSemesters.flatMap((sem) =>
      sem.subjects.map((subject) => ({
        code: subject.code,
        name: subject.name,
        semester: sem.semester,
        grade: subject.grade,
        status: subject.included ? "Included" : "Excluded",
      })),
    ),
  };
};

export default function ComparisonsPage() {
  const {
    canQuery,
    semester,
    department,
    batch,
    studentsDirectory,
    meta,
    selectedSemesters,
  } = useExplorer();
  const [selectedStudents, setSelectedStudents] = useState<StudentOption[]>([]);
  const [subjectComparison, setSubjectComparison] = useState<DataState<SubjectComparisonTable>>(
    initialDataState,
  );
  const [trendProfiles, setTrendProfiles] = useState<DataState<StudentTrendProfile[]>>(
    initialDataState,
  );

  const studentOptions = useMemo<StudentOption[]>(() => {
    if (!studentsDirectory.data) return [];
    return studentsDirectory.data.map((item) => ({
      value: item.regno,
      label: `${item.name} (${item.regno})`,
    }));
  }, [studentsDirectory.data]);

  const onGenerateSubjectComparison = async (event: FormEvent) => {
    event.preventDefault();
    if (!canQuery) return;

    if (selectedStudents.length < 2) {
      setSubjectComparison({
        loading: false,
        error: "Select at least two students for comparison.",
        data: null,
      });
      setTrendProfiles({
        loading: false,
        error: "Select at least two students for trend comparison.",
        data: null,
      });
      return;
    }
    if (selectedStudents.length > 12) {
      const message = "Comparison supports up to 12 students.";
      setSubjectComparison({ loading: false, error: message, data: null });
      setTrendProfiles({ loading: false, error: message, data: null });
      return;
    }

    setSubjectComparison({ loading: true, error: null, data: null });
    setTrendProfiles({ loading: true, error: null, data: null });

    const allSemesterCsv =
      meta.data?.semesters && meta.data.semesters.length > 0
        ? [...meta.data.semesters].sort((a, b) => a - b).join(",")
        : selectedSemesters.length > 0
          ? [...selectedSemesters].sort((a, b) => a - b).join(",")
          : String(semester);

    const settled = await Promise.allSettled(
      selectedStudents.map((item) =>
        api.getCgpaBreakdown({
          semesters: allSemesterCsv,
          department,
          batch: batch || null,
          regno: item.value,
        }),
      ),
    );

    const students: ReturnType<typeof toSelectedSemesterComparisonStudent>[] = [];
    const profiles: StudentTrendProfile[] = [];
    const failures: string[] = [];

    settled.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        students.push(
          toSelectedSemesterComparisonStudent(result.value, selectedSemesters),
        );
        profiles.push(toTrendProfile(result.value));
        return;
      }

      const label = selectedStudents[idx]?.label ?? selectedStudents[idx]?.value ?? "student";
      const message = result.reason instanceof Error ? result.reason.message : "load failed";
      failures.push(`${label}: ${message}`);
    });

    if (students.length < 2) {
      const message = failures[0] ?? "Unable to load comparison data for at least two students.";
      setSubjectComparison({ loading: false, error: message, data: null });
      setTrendProfiles({ loading: false, error: message, data: null });
      return;
    }

    const table = buildSubjectComparisonTable(students);
    setSubjectComparison({
      loading: false,
      error: failures.length > 0 ? failures.slice(0, 2).join(" | ") : null,
      data: table,
    });

    profiles.sort((a, b) => a.regno.localeCompare(b.regno));
    setTrendProfiles({
      loading: false,
      error: failures.length > 0 ? failures.slice(0, 2).join(" | ") : null,
      data: profiles,
    });
  };

  const sgpaTrendData = useMemo(() => {
    if (!trendProfiles.data) return [];
    const semestersSet = new Set<number>();
    trendProfiles.data.forEach((student) => {
      student.trend.forEach((item) => semestersSet.add(item.semester));
    });

    const semesters = [...semestersSet].sort((a, b) => a - b);
    return semesters.map((sem) => {
      const row: Record<string, string | number | null> = {
        semester: `S${sem}`,
        semNo: sem,
      };

      trendProfiles.data?.forEach((student) => {
        const point = student.trend.find((item) => item.semester === sem);
        row[student.regno] = point?.sgpa ?? null;
      });

      return row;
    });
  }, [trendProfiles.data]);

  const cgpaTrendData = useMemo(() => {
    if (!trendProfiles.data) return [];
    const semestersSet = new Set<number>();
    trendProfiles.data.forEach((student) => {
      student.trend.forEach((item) => semestersSet.add(item.semester));
    });

    const semesters = [...semestersSet].sort((a, b) => a - b);
    return semesters.map((sem) => {
      const row: Record<string, string | number | null> = {
        semester: `S${sem}`,
        semNo: sem,
      };

      trendProfiles.data?.forEach((student) => {
        const point = student.trend.find((item) => item.semester === sem);
        row[student.regno] = point?.cgpa ?? null;
      });

      return row;
    });
  }, [trendProfiles.data]);

  const radarProfiles = useMemo(
    () => (trendProfiles.data ? trendProfiles.data.slice(0, 6) : []),
    [trendProfiles.data],
  );

  const radarData = useMemo(() => {
    if (radarProfiles.length === 0) return [];

    const rows: Array<Record<string, string | number>> = [
      { metric: "Overall CGPA" },
      { metric: "Average SGPA" },
      { metric: "Best SGPA" },
      { metric: "Consistency" },
      { metric: "Arrear Control" },
    ];

    radarProfiles.forEach((profile) => {
      rows[0][profile.regno] = Number(profile.metrics.cgpa.toFixed(2));
      rows[1][profile.regno] = Number(profile.metrics.avgSgpa.toFixed(2));
      rows[2][profile.regno] = Number(profile.metrics.bestSgpa.toFixed(2));
      rows[3][profile.regno] = Number(profile.metrics.consistency.toFixed(2));
      rows[4][profile.regno] = Number(profile.metrics.arrearControl.toFixed(2));
    });

    return rows;
  }, [radarProfiles]);

  const semesterComparisonRows = useMemo<SemesterComparisonRow[]>(() => {
    if (!trendProfiles.data) {
      return [];
    }

    const detailedSemesters =
      selectedSemesters.length > 0
        ? new Set(selectedSemesters)
        : null;

    const semestersSet = new Set<number>();
    trendProfiles.data.forEach((profile) => {
      profile.trend.forEach((point) => semestersSet.add(point.semester));
    });

    const semesters = [...semestersSet]
      .filter((semesterNo) => !detailedSemesters || detailedSemesters.has(semesterNo))
      .sort((a, b) => b - a);

    return semesters.map((semesterNo) => ({
      semester: semesterNo,
      values: trendProfiles.data!.map((profile) => {
        const point = profile.trend.find((item) => item.semester === semesterNo);
        return {
          regno: profile.regno,
          sgpa: point?.sgpa ?? null,
          cgpa: point?.cgpa ?? null,
          arrears: point?.arrears ?? 0,
        };
      }),
    }));
  }, [selectedSemesters, trendProfiles.data]);

  const overallSemesterScope = useMemo(() => {
    const semesters = meta.data?.semesters ?? [];
    return formatSemesterScope(semesters);
  }, [meta.data?.semesters]);

  const detailedSemesterScope = useMemo(
    () => formatSemesterScope(selectedSemesters),
    [selectedSemesters],
  );

  return (
    <div className="p-4 overflow-auto max-h-[calc(100vh-180px)] flex flex-col gap-4">
      {!canQuery && (
        <p className="text-sm text-[var(--muted)] m-0">
          Select department and semesters to run comparisons.
        </p>
      )}

      <div className="border border-[#dbe3ff] rounded-[14px] p-4 bg-[#f9fbff] flex flex-col gap-3">
        <div>
          <h3 className="m-0 text-[1rem] font-bold text-[var(--foreground)]">
            Multi-Student Comparison Workspace
          </h3>
          <p className="m-0 text-[0.8rem] text-slate-500">
            Compare 2 to 12 students with trend overlays, radar metrics, and subject spread.
          </p>
        </div>

        <form onSubmit={onGenerateSubjectComparison} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="multi-student-select"
              className="text-[0.74rem] uppercase tracking-[0.04em] font-[650] text-[var(--muted)]"
            >
              Select Students
            </label>
            <Select<StudentOption, true>
              inputId="multi-student-select"
              options={studentOptions}
              value={selectedStudents}
              onChange={(options: MultiValue<StudentOption>) => setSelectedStudents([...options])}
              isMulti
              isLoading={studentsDirectory.loading}
              placeholder="Type and select multiple students..."
              classNamePrefix="rs"
              menuPortalTarget={typeof window !== "undefined" ? document.body : null}
              styles={{
                menuPortal: (base) => ({ ...base, zIndex: 70 }),
              }}
            />
            <p className="text-xs text-slate-500 m-0">Directory size: {studentOptions.length} students</p>
            {studentsDirectory.error && (
              <p className="text-sm font-semibold text-red-700 m-0">{studentsDirectory.error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={subjectComparison.loading || !canQuery}
            className="min-h-[40px] self-start rounded-[10px] border-none
              bg-gradient-to-br from-[#3040a0] to-[#000060] text-[#edf5ff]
              font-bold px-4 text-[0.91rem] cursor-pointer
              transition-all hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(28,52,129,0.26)]
              disabled:opacity-55 disabled:cursor-not-allowed"
          >
            {subjectComparison.loading ? "Comparing..." : "Run Comparison"}
          </button>
        </form>

        {subjectComparison.error && (
          <p className="text-sm font-semibold text-red-700 m-0">{subjectComparison.error}</p>
        )}
        {trendProfiles.error && !subjectComparison.error && (
          <p className="text-sm font-semibold text-red-700 m-0">{trendProfiles.error}</p>
        )}

        {trendProfiles.data && trendProfiles.data.length > 1 && (
          <div className="grid grid-cols-1 gap-3">
            <div className="border border-[#dbe3ff] rounded-[10px] p-3 bg-[#f6f9ff] flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="m-0 text-[0.82rem] font-semibold text-[var(--muted)]">
                  Overall Comparisons (All Semesters)
                </p>
                <p className="m-0 text-xs text-slate-500">Scope: {overallSemesterScope}</p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                <div className="border border-[#dbe3ff] rounded-[10px] p-3 bg-white">
                  <p className="m-0 text-[0.8rem] font-semibold text-[var(--muted)]">SGPA Trend Overlay</p>
                  <div className="h-[280px] mt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sgpaTrendData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="semester" {...axisProps} />
                        <YAxis {...axisProps} domain={[0, 10]} />
                        <Tooltip />
                        <Legend />
                        {trendProfiles.data.map((profile, idx) => (
                          <Line
                            key={`sgpa-${profile.regno}`}
                            type="monotone"
                            dataKey={profile.regno}
                            name={`${profile.name} (${profile.regno.slice(-3)})`}
                            stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                            strokeWidth={2.2}
                            dot={{ r: 2.5 }}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="border border-[#dbe3ff] rounded-[10px] p-3 bg-white">
                  <p className="m-0 text-[0.8rem] font-semibold text-[var(--muted)]">Cumulative CGPA Trend Overlay</p>
                  <div className="h-[280px] mt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={cgpaTrendData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="semester" {...axisProps} />
                        <YAxis {...axisProps} domain={[0, 10]} />
                        <Tooltip />
                        <Legend />
                        {trendProfiles.data.map((profile, idx) => (
                          <Line
                            key={`cgpa-${profile.regno}`}
                            type="monotone"
                            dataKey={profile.regno}
                            name={`${profile.name} (${profile.regno.slice(-3)})`}
                            stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                            strokeWidth={2.2}
                            dot={{ r: 2.5 }}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="border border-[#dbe3ff] rounded-[10px] p-3 bg-white">
                <div className="flex items-center justify-between gap-2">
                  <p className="m-0 text-[0.8rem] font-semibold text-[var(--muted)]">
                    Radar Comparison Across Metrics
                  </p>
                  {trendProfiles.data.length > radarProfiles.length && (
                    <p className="m-0 text-xs text-slate-500">
                      Showing first {radarProfiles.length} students for readability.
                    </p>
                  )}
                </div>

                <div className="h-[320px] mt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" />
                      {radarProfiles.map((profile, idx) => (
                        <Radar
                          key={`radar-${profile.regno}`}
                          name={`${profile.name} (${profile.regno.slice(-3)})`}
                          dataKey={profile.regno}
                          stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                          fill={CHART_COLORS[idx % CHART_COLORS.length]}
                          fillOpacity={0.18}
                          strokeWidth={2}
                        />
                      ))}
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="border border-[#dbe3ff] rounded-[10px] p-3 bg-white">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="m-0 text-[0.82rem] font-semibold text-[var(--muted)]">
                  Detailed Comparisons (Workspace Semesters)
                </p>
                <p className="m-0 text-xs text-slate-500">Scope: {detailedSemesterScope}</p>
              </div>

              <div className="overflow-auto mt-2">
                <table className="w-full border-collapse">
                  <THead
                    cols={[
                      "Semester",
                      ...trendProfiles.data.flatMap((profile) => [
                        `${profile.name} SGPA`,
                        `${profile.name} CGPA`,
                        `${profile.name} Arrears`,
                      ]),
                    ]}
                  />
                  <tbody>
                    {semesterComparisonRows.map((row) => (
                      <tr key={`all-sem-${row.semester}`} className="hover:bg-[#f4f7ff] transition-colors">
                        <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">Semester {row.semester}</td>
                        {row.values.flatMap((value) => [
                          <td
                            key={`${row.semester}-${value.regno}-sgpa`}
                            className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]"
                          >
                            {value.sgpa == null ? "-" : value.sgpa.toFixed(2)}
                          </td>,
                          <td
                            key={`${row.semester}-${value.regno}-cgpa`}
                            className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]"
                          >
                            {value.cgpa == null ? "-" : value.cgpa.toFixed(2)}
                          </td>,
                          <td
                            key={`${row.semester}-${value.regno}-arrears`}
                            className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]"
                          >
                            {value.arrears}
                          </td>,
                        ])}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {subjectComparison.data ? (
          (() => {
            const comparisonData = subjectComparison.data;

            return (
              <div className="border border-[#dbe3ff] rounded-[10px] p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="m-0 text-[0.82rem] font-semibold text-[var(--muted)]">
                    Detailed Subject Comparison (Workspace Semesters)
                  </p>
                  <p className="m-0 text-xs text-slate-500">Scope: {detailedSemesterScope}</p>
                </div>

                <div className="overflow-auto">
                  <table className="w-full border-collapse">
                    <THead cols={comparisonData.headers} />
                    <tbody>
                      {comparisonData.rows.map((row, index) => {
                        const previousRow =
                          index > 0 ? comparisonData.rows[index - 1] : null;
                        const showSemesterHeader = row.semester !== previousRow?.semester;
                        const sectionTitle =
                          row.semester == null ? "Overall" : `Semester ${row.semester}`;
                        const rowKey =
                          row.semester == null
                            ? `overall-${row.subjectCode}`
                            : `semester-${row.semester}-${row.subjectCode}`;

                        return (
                          <Fragment key={rowKey}>
                            {showSemesterHeader && (
                              <tr className="bg-[#f3f6ff]">
                                <td
                                  colSpan={comparisonData.headers.length}
                                  className="px-2.5 py-2 text-[0.78rem] uppercase tracking-[0.05em] font-bold text-[var(--muted)] border-b border-[#dbe3ff]"
                                >
                                  {sectionTitle}
                                </td>
                              </tr>
                            )}
                            <tr className="hover:bg-[#f4f7ff] transition-colors">
                              <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">{row.subjectCode}</td>
                              <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                                {row.subjectName || "-"}
                              </td>
                              {row.points.map((cell, pointIndex) => (
                                <td
                                  key={`${rowKey}-p-${pointIndex}`}
                                  className={`px-2.5 py-2 text-sm border-b border-[#dbe3ff] ${
                                    cell.diff > 0 ? "text-green-800 font-semibold" : "text-slate-500"
                                  }`}
                                >
                                  <span>{cell.value}</span>
                                  {cell.diff > 0 && <span className="ml-1 text-xs">(+{cell.diff})</span>}
                                </td>
                              ))}
                              <td
                                className={`px-2.5 py-2 text-sm border-b border-[#dbe3ff] ${
                                  row.spread > 0 ? "text-sky-700 font-semibold" : "text-slate-400"
                                }`}
                              >
                                {row.spread > 0 ? `+${row.spread}` : "-"}
                              </td>
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {comparisonData.footer.length > 0 && (
                  <div className="border-t border-dashed border-[#d7dff7] pt-2.5 flex flex-col gap-1.5">
                    {comparisonData.footer.map((note) => (
                      <p key={note} className="text-sm text-slate-600 m-0">
                        {note}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          <p className="text-xs text-slate-500 m-0">
            No comparison generated yet. Select students and click Run Comparison.
          </p>
        )}
      </div>
    </div>
  );
}
