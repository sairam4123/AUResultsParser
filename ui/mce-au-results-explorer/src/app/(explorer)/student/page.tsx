"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Select, { type SingleValue } from "react-select";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  api,
  type CgpaBreakdownResponse,
  type StudentResponse,
} from "../../../lib/api";
import { axisProps, gridProps } from "../../_explorer/chartTheme";
import { useExplorer } from "../../_explorer/context";
import { type StudentOption } from "../../_explorer/types";
import { initialDataState, type DataState } from "../../_explorer/types";
import { fmtMaybe, fmtNumber } from "../../_explorer/utils";

const gradePointMap: Record<string, number> = {
  O: 10,
  "A+": 9,
  A: 8,
  "B+": 7,
  B: 6,
  C: 5,
  U: 0,
  UA: 0,
  NA: 0,
  NC: 0,
};

// ── Shared sub-components ──────────────────────────────────

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

const Td = ({ children }: { children: React.ReactNode }) => (
  <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">{children}</td>
);

const ScrollTable = ({
  cols,
  children,
}: {
  cols: string[];
  children: React.ReactNode;
}) => (
  <div className="overflow-auto max-h-64 border border-[#dbe3ff] rounded-[10px]">
    <table className="w-full border-collapse">
      <THead cols={cols} />
      <tbody>{children}</tbody>
    </table>
  </div>
);

const ResultBlock = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="border border-[#dbe3ff] rounded-[14px] p-4 bg-[#fffefb] flex flex-col gap-3">
    <p className="text-[0.95rem] font-bold m-0 text-[var(--foreground)]">
      {title}
    </p>
    {children}
  </div>
);

const Notice = ({
  error,
  children,
}: {
  error?: boolean;
  children: React.ReactNode;
}) => (
  <p
    className={`text-sm m-0 ${error ? "text-red-700 font-semibold" : "text-[var(--muted)]"}`}
  >
    {children}
  </p>
);

type RankTrendPoint = {
  semester: number;
  sgpa: number | null;
  sgpaRank: number | null;
  cgpa: number | null;
  cgpaRank: number | null;
};

// ── Page content ───────────────────────────────────────────

function StudentPageContent() {
  const { canQuery, semester, department, batch, meta, studentsDirectory } =
    useExplorer();
  const searchParams = useSearchParams();
  const [regnoInput, setRegnoInput] = useState<string>(
    () => searchParams.get("regno")?.trim() ?? "",
  );
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(
    null,
  );
  const [student, setStudent] =
    useState<DataState<StudentResponse>>(initialDataState);
  const [cgpaBreakdown, setCgpaBreakdown] =
    useState<DataState<CgpaBreakdownResponse>>(initialDataState);
  const [rankTrend, setRankTrend] =
    useState<DataState<RankTrendPoint[]>>(initialDataState);
  const autoLoadedRegno = useRef<string | null>(null);

  const studentOptions = useMemo<StudentOption[]>(() => {
    if (!studentsDirectory.data) {
      return [];
    }

    return studentsDirectory.data.map((item) => ({
      value: item.regno,
      label: `${item.name} (${item.regno})`,
    }));
  }, [studentsDirectory.data]);

  const cgpaSemestersDesc = useMemo(() => {
    if (!cgpaBreakdown.data) {
      return [];
    }

    return [...cgpaBreakdown.data.semesters].sort(
      (a, b) => b.semester - a.semester,
    );
  }, [cgpaBreakdown.data]);

  const selectedStudentValue = useMemo(() => {
    if (selectedStudent) {
      return selectedStudent;
    }

    const regno = regnoInput.trim().toUpperCase();
    if (!regno) {
      return null;
    }

    return (
      studentOptions.find((item) => item.value.toUpperCase() === regno) ?? null
    );
  }, [regnoInput, selectedStudent, studentOptions]);

  const trendRows = useMemo(() => {
    if (!cgpaBreakdown.data) return [];

    const rows = [...cgpaBreakdown.data.semesters].sort(
      (a, b) => a.semester - b.semester,
    );
    let cumulativeCredits = 0;
    let cumulativeGradePoints = 0;
    let cumulativeArrears = 0;

    return rows.map((row) => {
      cumulativeCredits += row.totals.credits;
      cumulativeGradePoints += row.totals.grade_points;
      cumulativeArrears += row.totals.arrears;
      const cumulativeCgpa =
        cumulativeCredits > 0
          ? Number((cumulativeGradePoints / cumulativeCredits).toFixed(2))
          : null;

      return {
        semester: row.semester,
        sgpa: row.totals.sgpa,
        cumulativeCgpa,
        arrears: row.totals.arrears,
        cumulativeArrears,
      };
    });
  }, [cgpaBreakdown.data]);

  const rankAxisMax = useMemo(() => {
    if (!rankTrend.data || rankTrend.data.length === 0) {
      return 10;
    }

    const values = rankTrend.data
      .flatMap((item) => [item.sgpaRank, item.cgpaRank])
      .filter(
        (value): value is number => value != null && Number.isFinite(value),
      );

    if (values.length === 0) {
      return 10;
    }

    return Math.max(...values) + 1;
  }, [rankTrend.data]);

  const lookupStudent = useCallback(
    async (rawRegno: string) => {
      if (!canQuery) return;
      const regno = rawRegno.trim();
      if (!regno) {
        setStudent({
          loading: false,
          error: "Enter a register number",
          data: null,
        });
        return;
      }
      setStudent({ loading: true, error: null, data: null });
      setCgpaBreakdown({ loading: true, error: null, data: null });
      setRankTrend({ loading: true, error: null, data: null });

      const allSemestersAsc =
        meta.data?.semesters.length && meta.data.semesters.length > 0
          ? [...meta.data.semesters].sort((a, b) => a - b)
          : [semester];
      const semestersCsv = [...allSemestersAsc].sort((a, b) => b - a).join(",");

      const rankTrendPromise = Promise.allSettled(
        allSemestersAsc.map(async (semNo) => {
          const [studentPayload, cgpaClassPayload] = await Promise.all([
            api.getStudent(semNo, department, batch || null, regno),
            api.getCgpaClass({
              semesters: allSemestersAsc
                .filter((item) => item <= semNo)
                .join(","),
              department,
              batch: batch || null,
              sortBy: "cgpa",
            }),
          ]);

          const cgpaRankIndex = cgpaClassPayload.rows.findIndex(
            (item) => item.regno.toUpperCase() === regno.toUpperCase(),
          );
          const cgpaRow =
            cgpaRankIndex >= 0 ? cgpaClassPayload.rows[cgpaRankIndex] : null;

          return {
            semester: semNo,
            sgpa: studentPayload.student.sgpa,
            sgpaRank: studentPayload.student.rank,
            cgpa: cgpaRow?.cgpa ?? null,
            cgpaRank: cgpaRankIndex >= 0 ? cgpaRankIndex + 1 : null,
          } as RankTrendPoint;
        }),
      );

      const [studentResult, cgpaResult, rankTrendResult] =
        await Promise.allSettled([
          api.getStudent(semester, department, batch || null, regno),
          api.getCgpaBreakdown({
            semesters: semestersCsv,
            department,
            batch: batch || null,
            regno,
          }),
          rankTrendPromise,
        ]);

      if (studentResult.status === "fulfilled") {
        setStudent({ loading: false, error: null, data: studentResult.value });
      } else {
        const message =
          studentResult.reason instanceof Error
            ? studentResult.reason.message
            : "Lookup failed";
        setStudent({ loading: false, error: message, data: null });
      }

      if (cgpaResult.status === "fulfilled") {
        setCgpaBreakdown({
          loading: false,
          error: null,
          data: cgpaResult.value,
        });
      } else {
        const message =
          cgpaResult.reason instanceof Error
            ? cgpaResult.reason.message
            : "CGPA breakdown lookup failed";
        setCgpaBreakdown({ loading: false, error: message, data: null });
      }

      if (rankTrendResult.status === "fulfilled") {
        const points: RankTrendPoint[] = [];
        const failedSemesters: number[] = [];

        rankTrendResult.value.forEach((item, index) => {
          if (item.status === "fulfilled") {
            points.push(item.value);
            return;
          }
          failedSemesters.push(allSemestersAsc[index]);
        });

        if (points.length === 0) {
          setRankTrend({
            loading: false,
            error: "Unable to load SGPA/CGPA rank trends.",
            data: null,
          });
        } else {
          setRankTrend({
            loading: false,
            error:
              failedSemesters.length > 0
                ? `Some rank points missing: ${failedSemesters
                    .map((item) => `S${item}`)
                    .join(", ")}`
                : null,
            data: points.sort((a, b) => a.semester - b.semester),
          });
        }
      } else {
        setRankTrend({
          loading: false,
          error: "Unable to load SGPA/CGPA rank trends.",
          data: null,
        });
      }
    },
    [batch, canQuery, department, meta.data?.semesters, semester],
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const regno = selectedStudentValue?.value ?? regnoInput;
    void lookupStudent(regno);
  };

  useEffect(() => {
    const regnoFromQuery = searchParams.get("regno")?.trim();
    if (!canQuery || !regnoFromQuery) {
      return;
    }

    if (autoLoadedRegno.current === regnoFromQuery) {
      return;
    }

    autoLoadedRegno.current = regnoFromQuery;
    void lookupStudent(regnoFromQuery);
  }, [canQuery, lookupStudent, searchParams]);

  return (
    <div className="p-4 overflow-auto max-h-[calc(100vh-180px)] flex flex-col gap-4">
      {/* Lookup form */}
      <form
        className="grid grid-cols-[1fr_auto] gap-2.5 items-end"
        onSubmit={onSubmit}
      >
        <Select<StudentOption, false>
          inputId="student-regno-select"
          options={studentOptions}
          value={selectedStudentValue}
          onChange={(option: SingleValue<StudentOption>) => {
            setSelectedStudent(option);
            setRegnoInput(option?.value ?? "");
          }}
          onInputChange={(value, metaAction) => {
            if (metaAction.action !== "input-change") {
              return;
            }

            setRegnoInput(value);
            if (
              selectedStudent &&
              selectedStudent.value.toUpperCase() !== value.trim().toUpperCase()
            ) {
              setSelectedStudent(null);
            }
          }}
          isLoading={studentsDirectory.loading}
          isClearable
          isSearchable
          placeholder="Search student by name or regno"
          classNamePrefix="rs"
          menuPortalTarget={
            typeof window !== "undefined" ? document.body : null
          }
          styles={{
            menuPortal: (base) => ({ ...base, zIndex: 70 }),
          }}
        />
        <button
          type="submit"
          disabled={!canQuery}
          className="min-h-[40px] rounded-[10px] border-none
            bg-gradient-to-br from-[#3040a0] to-[#000060] text-[#edf5ff]
            font-bold px-4 text-[0.91rem] cursor-pointer whitespace-nowrap
            transition-all hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(28,52,129,0.26)]
            disabled:opacity-55 disabled:cursor-not-allowed"
        >
          View Student
        </button>
      </form>

      {!canQuery && (
        <Notice>Select department and semesters to query student data.</Notice>
      )}
      {student.loading && <Notice>Loading student profile...</Notice>}
      {student.error && <Notice error>{student.error}</Notice>}

      {student.data && (
        <>
          {/* Student header */}
          <div className="mb-1 border border-[#dbe3ff] rounded-[14px] bg-[#f7f9ff] p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="m-0 mb-1 text-[1.1rem] font-bold text-[var(--foreground)]">
                  {student.data.student.name}
                </h3>
                <p className="m-0 text-[var(--muted)] text-sm">
                  {student.data.student.regno} • Current SGPA{" "}
                  {fmtNumber(student.data.student.sgpa)} • Rank{" "}
                  {student.data.student.rank ?? "–"}
                </p>
              </div>
              <Link
                href={`/audit?regno=${encodeURIComponent(student.data.student.regno)}`}
                className="min-h-[36px] inline-flex items-center rounded-[10px] border border-[#96a5e6]
                  bg-[#f1f4ff] text-[var(--foreground)] font-[650] px-3 text-[0.82rem] no-underline
                  transition-all hover:bg-[#e4eaff] hover:shadow-[0_3px_10px_rgba(48,64,160,0.13)]"
              >
                Open Audit Page
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-[12px] px-4 py-3 bg-gradient-to-br from-[#1c2f8f] to-[#000a59] text-[#f3f7ff]">
                <p className="m-0 text-[0.72rem] uppercase tracking-[0.08em] font-[650] opacity-90">
                  Overall CGPA
                </p>
                <p className="m-0 mt-1 text-[2rem] font-black leading-none">
                  {cgpaBreakdown.data
                    ? fmtMaybe(cgpaBreakdown.data.overall.cgpa)
                    : "-"}
                </p>
              </div>

              <div className="rounded-[12px] px-4 py-3 bg-gradient-to-br from-[#951f43] to-[#5d0822] text-[#fff4f6]">
                <p className="m-0 text-[0.72rem] uppercase tracking-[0.08em] font-[650] opacity-90">
                  Total Arrears
                </p>
                <p className="m-0 mt-1 text-[2rem] font-black leading-none">
                  {cgpaBreakdown.data
                    ? cgpaBreakdown.data.overall.arrears
                    : "-"}
                </p>
              </div>
            </div>
          </div>

          {/* Trend charts */}
          {trendRows.length > 0 && (
            <ResultBlock title="SGPA / CGPA and Arrear Trends">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                <div className="border border-[#dbe3ff] rounded-[10px] p-2 bg-[#ffffff]">
                  <p className="m-0 px-2 pt-1 text-[0.78rem] font-semibold text-[var(--muted)]">
                    SGPA vs Cumulative CGPA
                  </p>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={trendRows}
                        margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid {...gridProps} />
                        <XAxis
                          dataKey="semester"
                          {...axisProps}
                          tickFormatter={(value) => `S${value}`}
                        />
                        <YAxis {...axisProps} domain={[0, 10]} />
                        <Tooltip
                          labelFormatter={(label) =>
                            `Semester ${String(label)}`
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="sgpa"
                          name="SGPA"
                          stroke="#3040a0"
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                          connectNulls
                        />
                        <Line
                          type="monotone"
                          dataKey="cumulativeCgpa"
                          name="Cumulative CGPA"
                          stroke="#e55381"
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="border border-[#dbe3ff] rounded-[10px] p-2 bg-[#ffffff]">
                  <p className="m-0 px-2 pt-1 text-[0.78rem] font-semibold text-[var(--muted)]">
                    SGPA Rank vs CGPA Rank
                  </p>
                  <div className="h-[250px]">
                    {rankTrend.loading && (
                      <p className="m-0 px-2 py-2 text-sm text-[var(--muted)]">
                        Loading rank trend...
                      </p>
                    )}
                    {rankTrend.error && (
                      <p className="m-0 px-2 py-2 text-sm text-red-700 font-semibold">
                        {rankTrend.error}
                      </p>
                    )}
                    {!rankTrend.loading &&
                      rankTrend.data &&
                      rankTrend.data.length > 0 && (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={rankTrend.data}
                            margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid {...gridProps} />
                            <XAxis
                              dataKey="semester"
                              {...axisProps}
                              tickFormatter={(value) => `S${value}`}
                            />
                            <YAxis
                              {...axisProps}
                              allowDecimals={false}
                              reversed
                              domain={[rankAxisMax, 1]}
                            />
                            <Tooltip
                              labelFormatter={(label) =>
                                `Semester ${String(label)}`
                              }
                              formatter={(value, name) => [
                                value == null ? "-" : String(value),
                                name,
                              ]}
                            />
                            <Line
                              type="monotone"
                              dataKey="sgpaRank"
                              name="SGPA Rank"
                              stroke="#3040a0"
                              strokeWidth={2.5}
                              dot={{ r: 3 }}
                              connectNulls
                            />
                            <Line
                              type="monotone"
                              dataKey="cgpaRank"
                              name="CGPA Rank"
                              stroke="#e55381"
                              strokeWidth={2.5}
                              dot={{ r: 3 }}
                              connectNulls
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                  </div>
                </div>

                <div className="border border-[#dbe3ff] rounded-[10px] p-2 bg-[#ffffff]">
                  <p className="m-0 px-2 pt-1 text-[0.78rem] font-semibold text-[var(--muted)]">
                    Arrear History
                  </p>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={trendRows}
                        margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid {...gridProps} />
                        <XAxis
                          dataKey="semester"
                          {...axisProps}
                          tickFormatter={(value) => `S${value}`}
                        />
                        <YAxis {...axisProps} allowDecimals={false} />
                        <Tooltip
                          labelFormatter={(label) =>
                            `Semester ${String(label)}`
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey="arrears"
                          name="Semester Arrears"
                          stroke="#f97316"
                          fill="#f9731630"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="cumulativeArrears"
                          name="Cumulative Arrears"
                          stroke="#be123c"
                          fill="#be123c20"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </ResultBlock>
          )}

          {/* Current semester subjects */}
          <ResultBlock title="Current Semester Subject Snapshot">
            <ScrollTable cols={["Code", "Subject", "Grade", "Status", "GP"]}>
              {student.data.student.subjects.map((item) => (
                <tr
                  key={item.code}
                  className="hover:bg-[#f4f7ff] transition-colors"
                >
                  <Td>{item.code}</Td>
                  <Td>{item.name}</Td>
                  <Td>{item.grade}</Td>
                  <Td>{item.status}</Td>
                  <Td>{gradePointMap[item.grade] ?? 0}</Td>
                </tr>
              ))}
            </ScrollTable>
          </ResultBlock>

          {/* CGPA Breakdown */}
          <ResultBlock title="SGPA and CGPA Calculation Breakdown">
            {cgpaBreakdown.loading && (
              <Notice>Loading CGPA calculations...</Notice>
            )}
            {cgpaBreakdown.error && (
              <Notice error>{cgpaBreakdown.error}</Notice>
            )}
            {cgpaBreakdown.data && (
              <>
                {/* Overall stats */}
                <div className="grid grid-cols-5 gap-2">
                  {[
                    {
                      label: "Current SGPA",
                      value: fmtMaybe(student.data.student.sgpa),
                    },
                    {
                      label: "Overall CGPA",
                      value: fmtMaybe(cgpaBreakdown.data.overall.cgpa),
                    },
                    {
                      label: "Total Credits",
                      value: cgpaBreakdown.data.overall.credits.toFixed(1),
                    },
                    {
                      label: "Total Grade Points",
                      value: cgpaBreakdown.data.overall.grade_points.toFixed(2),
                    },
                    {
                      label: "Total Arrears",
                      value: String(cgpaBreakdown.data.overall.arrears),
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="border border-dashed border-[#c6ceef] rounded-[10px] bg-[#f7f9ff] px-3 py-2.5"
                    >
                      <strong className="block text-[0.7rem] uppercase tracking-[0.04em] font-[650] text-[var(--muted)]">
                        {label}
                      </strong>
                      <p className="m-0 mt-1 text-[1.1rem] font-bold text-[var(--foreground)]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="text-sm text-slate-600 m-0">
                  Overall CGPA ={" "}
                  <strong>
                    {cgpaBreakdown.data.overall.grade_points.toFixed(2)}
                  </strong>{" "}
                  /{" "}
                  <strong>
                    {cgpaBreakdown.data.overall.credits.toFixed(1)}
                  </strong>{" "}
                  = <strong>{fmtMaybe(cgpaBreakdown.data.overall.cgpa)}</strong>
                </p>

                <ScrollTable
                  cols={[
                    "Semester",
                    "Credits",
                    "Grade Points",
                    "SGPA",
                    "Arrears",
                  ]}
                >
                  {cgpaSemestersDesc.map((item) => (
                    <tr
                      key={`sgpa-${item.semester}`}
                      className="hover:bg-[#f4f7ff] transition-colors"
                    >
                      <Td>Semester {item.semester}</Td>
                      <Td>{item.totals.credits.toFixed(1)}</Td>
                      <Td>{item.totals.grade_points.toFixed(2)}</Td>
                      <Td>{fmtMaybe(item.totals.sgpa)}</Td>
                      <Td>{item.totals.arrears}</Td>
                    </tr>
                  ))}
                </ScrollTable>

                {cgpaSemestersDesc.map((semesterBreakdown) => (
                  <div
                    key={`semester-breakdown-${semesterBreakdown.semester}`}
                    className="flex flex-col gap-2"
                  >
                    <p className="text-sm text-slate-600 m-0">
                      Semester {semesterBreakdown.semester} SGPA ={" "}
                      <strong>
                        {semesterBreakdown.totals.grade_points.toFixed(2)}
                      </strong>{" "}
                      /{" "}
                      <strong>
                        {semesterBreakdown.totals.credits.toFixed(1)}
                      </strong>{" "}
                      ={" "}
                      <strong>{fmtMaybe(semesterBreakdown.totals.sgpa)}</strong>
                    </p>
                    <ScrollTable
                      cols={[
                        "Code",
                        "Subject",
                        "Grade",
                        "Credit",
                        "GP",
                        "Credit × GP",
                        "Included",
                      ]}
                    >
                      {semesterBreakdown.subjects.map((item) => (
                        <tr
                          key={`subject-calc-${semesterBreakdown.semester}-${item.code}`}
                          className="hover:bg-[#f4f7ff] transition-colors"
                        >
                          <Td>{item.code}</Td>
                          <Td>{item.name}</Td>
                          <Td>{item.grade}</Td>
                          <Td>{item.credit.toFixed(1)}</Td>
                          <Td>{item.gp ?? "–"}</Td>
                          <Td>{item.credit_x_gp.toFixed(2)}</Td>
                          <Td>{item.included ? "Yes" : "No"}</Td>
                        </tr>
                      ))}
                    </ScrollTable>
                  </div>
                ))}
              </>
            )}
          </ResultBlock>
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
          <p className="text-sm text-[var(--muted)] m-0">
            Loading student tools...
          </p>
        </div>
      }
    >
      <StudentPageContent />
    </Suspense>
  );
}
