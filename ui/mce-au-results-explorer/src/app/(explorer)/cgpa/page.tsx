"use client";

import { type FormEvent, useMemo, useState } from "react";
import {
  api,
  type CgpaBreakdownResponse,
  type CgpaClassResponse,
  type CgpaCompareResponse,
} from "../../../lib/api";
import { useExplorer } from "../../_explorer/context";
import { initialDataState, type DataState } from "../../_explorer/types";
import { fmtMaybe, parseSemestersInput } from "../../_explorer/utils";

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

const Td = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <td className={`px-2.5 py-2 text-sm border-b border-[#dbe3ff] ${className ?? ""}`}>
    {children}
  </td>
);

const scrollTableClass = "overflow-auto border border-[#dbe3ff] rounded-[10px]";

const Notice = ({ error, children }: { error?: boolean; children: React.ReactNode }) => (
  <p className={`text-sm m-0 ${error ? "text-red-700 font-semibold" : "text-[var(--muted)]"}`}>
    {children}
  </p>
);

const SectionBlock = ({ children }: { children: React.ReactNode }) => (
  <div className="border border-[#dbe3ff] rounded-[14px] p-4 bg-[#f9fbff] flex flex-col gap-3">
    {children}
  </div>
);

const InputField = ({
  id,
  label,
  hint,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1">
    {id ? (
      <label htmlFor={id} className="text-[0.74rem] uppercase tracking-[0.04em] font-[650] text-[var(--muted)]">
        {label}
      </label>
    ) : (
      <span className="text-[0.74rem] uppercase tracking-[0.04em] font-[650] text-[var(--muted)]">
        {label}
      </span>
    )}
    {children}
    {hint && <p className="text-xs text-slate-500 m-0">{hint}</p>}
  </div>
);

const inputCls =
  "min-h-[40px] px-3 rounded-[10px] border border-[#7f8dd6] bg-white text-[var(--foreground)] " +
  "text-[0.91rem] outline-none focus:border-[#3040a0] focus:ring-2 focus:ring-[rgba(48,64,160,0.12)] transition-shadow";

const btnCls =
  "min-h-[40px] self-end rounded-[10px] border-none bg-gradient-to-br from-[#3040a0] to-[#000060] " +
  "text-[#edf5ff] font-bold px-4 text-[0.91rem] cursor-pointer whitespace-nowrap " +
  "transition-all hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(28,52,129,0.26)] " +
  "disabled:opacity-55 disabled:cursor-not-allowed";

const btnSecCls =
  "min-h-[40px] self-end rounded-[10px] border border-[#96a5e6] bg-[#f1f4ff] " +
  "text-[var(--foreground)] font-[650] px-4 text-[0.88rem] cursor-pointer whitespace-nowrap " +
  "transition-all hover:bg-[#e4eaff] hover:shadow-[0_3px_10px_rgba(48,64,160,0.13)]";

// ── Page ──────────────────────────────────────────────────

export default function CgpaPage() {
  const { canQuery, semester, department, batch } = useExplorer();
  const [semestersInput, setSemestersInput] = useState<string>("3,4,5");
  const [cgpaSortBy, setCgpaSortBy] = useState<"cgpa" | "arrears" | "regno">("cgpa");
  const [cgpaTopInput, setCgpaTopInput] = useState<string>("50");
  const [cgpaRegnoFilter, setCgpaRegnoFilter] = useState<string>("");
  const [cgpaClass, setCgpaClass] = useState<DataState<CgpaClassResponse>>(initialDataState);

  const [cgpaBreakdownRegno, setCgpaBreakdownRegno] = useState<string>("");
  const [cgpaBreakdown, setCgpaBreakdown] =
    useState<DataState<CgpaBreakdownResponse>>(initialDataState);

  const [cgpaCompareRegno1, setCgpaCompareRegno1] = useState<string>("");
  const [cgpaCompareRegno2, setCgpaCompareRegno2] = useState<string>("");
  const [cgpaSubjectDetails, setCgpaSubjectDetails] = useState<boolean>(false);
  const [cgpaCompare, setCgpaCompare] =
    useState<DataState<CgpaCompareResponse>>(initialDataState);
  const compareData = cgpaCompare.data;

  const cgpaRankByRegno = useMemo(() => {
    const map = new Map<string, number | null>();
    if (!cgpaClass.data) return map;
    const ranked = [...cgpaClass.data.rows].sort((l, r) => {
      if (l.cgpa == null && r.cgpa == null) return l.regno.localeCompare(r.regno);
      if (l.cgpa == null) return 1;
      if (r.cgpa == null) return -1;
      if (r.cgpa !== l.cgpa) return r.cgpa - l.cgpa;
      if (l.arrears !== r.arrears) return l.arrears - r.arrears;
      return l.regno.localeCompare(r.regno);
    });
    ranked.forEach((row, i) => map.set(row.regno, row.cgpa == null ? null : i + 1));
    return map;
  }, [cgpaClass.data]);

  const onLoadCgpaClass = async (event: FormEvent) => {
    event.preventDefault();
    if (!canQuery) return;
    const normalizedSemesters = parseSemestersInput(semestersInput);
    if (!normalizedSemesters) {
      setCgpaClass({ loading: false, error: "Enter valid semesters like 3,4,5.", data: null });
      return;
    }
    setCgpaClass({ loading: true, error: null, data: null });
    const topParsed = Number(cgpaTopInput.trim());
    const topValue =
      Number.isFinite(topParsed) && topParsed > 0 ? Math.floor(topParsed) : undefined;
    try {
      const payload = await api.getCgpaClass({
        semesters: normalizedSemesters,
        department,
        batch: batch || null,
        regno: cgpaRegnoFilter.trim() || undefined,
        sortBy: cgpaSortBy,
        top: topValue,
      });
      setCgpaClass({ loading: false, error: null, data: payload });
    } catch (error) {
      setCgpaClass({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load CGPA class",
        data: null,
      });
    }
  };

  const onLoadCgpaBreakdown = async (event: FormEvent) => {
    event.preventDefault();
    if (!canQuery) return;
    const regno = cgpaBreakdownRegno.trim();
    if (!regno) {
      setCgpaBreakdown({ loading: false, error: "Enter a register number.", data: null });
      return;
    }
    const normalizedSemesters = parseSemestersInput(semestersInput);
    if (!normalizedSemesters) {
      setCgpaBreakdown({
        loading: false,
        error: "Enter valid semesters like 3,4,5.",
        data: null,
      });
      return;
    }
    setCgpaBreakdown({ loading: true, error: null, data: null });
    try {
      const payload = await api.getCgpaBreakdown({
        semesters: normalizedSemesters,
        department,
        batch: batch || null,
        regno,
      });
      setCgpaBreakdown({ loading: false, error: null, data: payload });
    } catch (error) {
      setCgpaBreakdown({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load CGPA breakdown",
        data: null,
      });
    }
  };

  const onLoadCgpaCompare = async (event: FormEvent) => {
    event.preventDefault();
    if (!canQuery) return;
    const regno1 = cgpaCompareRegno1.trim();
    const regno2 = cgpaCompareRegno2.trim();
    if (!regno1 || !regno2) {
      setCgpaCompare({ loading: false, error: "Enter both register numbers.", data: null });
      return;
    }
    const normalizedSemesters = parseSemestersInput(semestersInput);
    if (!normalizedSemesters) {
      setCgpaCompare({
        loading: false,
        error: "Enter valid semesters like 3,4,5.",
        data: null,
      });
      return;
    }
    setCgpaCompare({ loading: true, error: null, data: null });
    try {
      const payload = await api.getCgpaCompare({
        semesters: normalizedSemesters,
        department,
        batch: batch || null,
        regno1,
        regno2,
        subjectDetails: cgpaSubjectDetails,
      });
      setCgpaCompare({ loading: false, error: null, data: payload });
    } catch (error) {
      setCgpaCompare({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to compare CGPA profiles",
        data: null,
      });
    }
  };

  return (
    <div className="p-4 overflow-auto max-h-[calc(100vh-180px)] flex flex-col gap-4">
      {!canQuery && <Notice>Select department and semester to run CGPA analytics.</Notice>}

      {/* ── Semester set ──────────────────────────────── */}
      <SectionBlock>
        <div>
          <h3 className="m-0 text-[1rem] font-bold text-[var(--foreground)]">
            CGPA Across Semesters
          </h3>
          <p className="m-0 text-[0.8rem] text-slate-500">
            One semester set for class ranking, detailed student CGPA, and two-student comparison.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <InputField id="cgpa-semesters" label="Semesters" hint="Comma-separated, e.g. 3,4,5">
            <input
              id="cgpa-semesters"
              value={semestersInput}
              onChange={(e) => setSemestersInput(e.target.value)}
              placeholder="3,4,5"
              className={inputCls}
            />
          </InputField>
          <button
            type="button"
            className={btnSecCls}
            onClick={() => setSemestersInput(String(semester))}
          >
            Use Current Semester ({semester})
          </button>
        </div>
      </SectionBlock>

      {/* ── Class CGPA ranking ────────────────────────── */}
      <SectionBlock>
        <div>
          <h3 className="m-0 text-[1rem] font-bold text-[var(--foreground)]">
            Class CGPA Ranking
          </h3>
          <p className="m-0 text-[0.8rem] text-slate-500">
            Default order: CGPA desc, arrears asc, regno asc.
          </p>
        </div>

        <form onSubmit={onLoadCgpaClass} className="flex flex-wrap items-end gap-3">
          <InputField id="cgpa-sort" label="Sort By">
            <select
              id="cgpa-sort"
              value={cgpaSortBy}
              onChange={(e) => setCgpaSortBy(e.target.value as "cgpa" | "arrears" | "regno")}
              className={`${inputCls} w-44`}
            >
              <option value="cgpa">CGPA</option>
              <option value="arrears">Arrears</option>
              <option value="regno">Reg No</option>
            </select>
          </InputField>

          <InputField id="cgpa-top" label="Record Limit">
            <input
              id="cgpa-top"
              type="number"
              min={1}
              value={cgpaTopInput}
              onChange={(e) => setCgpaTopInput(e.target.value)}
              className={`${inputCls} w-44`}
            />
          </InputField>

          <InputField id="cgpa-regno-filter" label="RegNo Filter (optional)">
            <input
              id="cgpa-regno-filter"
              value={cgpaRegnoFilter}
              onChange={(e) => setCgpaRegnoFilter(e.target.value)}
              placeholder="812823205060"
              className={`${inputCls} min-w-[220px] flex-1`}
            />
          </InputField>

          <button type="submit" disabled={cgpaClass.loading || !canQuery} className={btnCls}>
            {cgpaClass.loading ? "Loading…" : "Load Class CGPA"}
          </button>
        </form>

        {cgpaClass.error && <Notice error>{cgpaClass.error}</Notice>}

        {cgpaClass.data && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600 m-0">
              Students: <strong>{cgpaClass.data.summary.students_considered}</strong> | Avg CGPA:{" "}
              <strong>{cgpaClass.data.summary.average_cgpa.toFixed(2)}</strong> | Total Arrears:{" "}
              <strong>{cgpaClass.data.summary.total_arrears}</strong> | No Arrears:{" "}
              <strong>{cgpaClass.data.summary.students_without_arrears}</strong>
            </p>
            <div className={scrollTableClass}>
              <table className="w-full border-collapse">
                <THead
                  cols={[
                    "Reg No",
                    "Name",
                    "CGPA Rank",
                    ...cgpaClass.data.semesters.map((s) => `S${s} SGPA`),
                    "CGPA",
                    "Arrears",
                    "Credits",
                  ]}
                />
                <tbody>
                  {cgpaClass.data.rows.map((row) => (
                    <tr key={row.regno} className="hover:bg-[#f4f7ff] transition-colors">
                      <Td>{row.regno}</Td>
                      <Td>{row.name}</Td>
                      <Td>{cgpaRankByRegno.get(row.regno) ?? "N/A"}</Td>
                      {cgpaClass.data?.semesters.map((sem) => (
                        <Td key={`${row.regno}-s${sem}`}>
                          {fmtMaybe(row.semester_sgpa[String(sem)] ?? null)}
                        </Td>
                      ))}
                      <Td>{fmtMaybe(row.cgpa)}</Td>
                      <Td>{row.arrears}</Td>
                      <Td>{row.credits.toFixed(1)}</Td>
                    </tr>
                  ))}
                  {cgpaClass.data.rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={7 + cgpaClass.data.semesters.length}
                        className="px-2.5 py-3 text-sm text-center text-[var(--muted)]"
                      >
                        No students found for this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SectionBlock>

      {/* ── Single student CGPA breakdown ─────────────── */}
      <SectionBlock>
        <div>
          <h3 className="m-0 text-[1rem] font-bold text-[var(--foreground)]">
            Single Student Detailed CGPA
          </h3>
          <p className="m-0 text-[0.8rem] text-slate-500">
            Semester-wise and subject-wise calculation breakdown.
          </p>
        </div>

        <form onSubmit={onLoadCgpaBreakdown} className="flex flex-wrap items-end gap-3">
          <InputField id="cgpa-breakdown-regno" label="Register Number">
            <input
              id="cgpa-breakdown-regno"
              value={cgpaBreakdownRegno}
              onChange={(e) => setCgpaBreakdownRegno(e.target.value)}
              placeholder="812823205060"
              className={`${inputCls} min-w-[240px] flex-1`}
            />
          </InputField>
          <button
            type="submit"
            disabled={cgpaBreakdown.loading || !canQuery}
            className={btnCls}
          >
            {cgpaBreakdown.loading ? "Loading…" : "Load Student Breakdown"}
          </button>
        </form>

        {cgpaBreakdown.error && <Notice error>{cgpaBreakdown.error}</Notice>}

        {cgpaBreakdown.data && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold m-0">
              {cgpaBreakdown.data.name} ({cgpaBreakdown.data.regno})
            </p>
            {cgpaBreakdown.data.semesters.map((semesterData) => (
              <div
                key={`bd-sem-${semesterData.semester}`}
                className="border border-[#dbe3ff] rounded-[10px] p-3 flex flex-col gap-2.5"
              >
                <h3 className="m-0 text-[0.95rem] font-bold text-[var(--foreground)]">
                  Semester {semesterData.semester}
                </h3>
                <p className="text-sm text-slate-600 m-0">
                  SGPA = {semesterData.totals.grade_points.toFixed(2)} /{" "}
                  {semesterData.totals.credits.toFixed(1)} ={" "}
                  <strong>{fmtMaybe(semesterData.totals.sgpa)}</strong> | Arrears:{" "}
                  <strong>{semesterData.totals.arrears}</strong>
                </p>
                <div className={scrollTableClass}>
                  <table className="w-full border-collapse">
                    <THead
                      cols={["Code", "Subject", "Grade", "Credit", "GP", "Credit × GP", "Included"]}
                    />
                    <tbody>
                      {semesterData.subjects.map((subject) => (
                        <tr
                          key={`${semesterData.semester}-${subject.code}`}
                          className="hover:bg-[#f4f7ff] transition-colors"
                        >
                          <Td>{subject.code}</Td>
                          <Td>{subject.name}</Td>
                          <Td>{subject.grade}</Td>
                          <Td>{subject.credit.toFixed(1)}</Td>
                          <Td>{subject.gp ?? "–"}</Td>
                          <Td>{subject.credit_x_gp.toFixed(2)}</Td>
                          <Td>{subject.included ? "Yes" : "No"}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            <p className="text-sm text-slate-600 m-0">
              Overall CGPA = {cgpaBreakdown.data.overall.grade_points.toFixed(2)} /{" "}
              {cgpaBreakdown.data.overall.credits.toFixed(1)} ={" "}
              <strong>{fmtMaybe(cgpaBreakdown.data.overall.cgpa)}</strong> | Total Arrears:{" "}
              <strong>{cgpaBreakdown.data.overall.arrears}</strong>
            </p>
          </div>
        )}
      </SectionBlock>

      {/* ── Two-student comparison ────────────────────── */}
      <SectionBlock>
        <div>
          <h3 className="m-0 text-[1rem] font-bold text-[var(--foreground)]">
            Two-Student CGPA Comparison
          </h3>
          <p className="m-0 text-[0.8rem] text-slate-500">
            Compare semester SGPA, overall CGPA, arrears, credits, and subject impact.
          </p>
        </div>

        <form onSubmit={onLoadCgpaCompare} className="flex flex-wrap items-end gap-3">
          <InputField id="cgpa-compare-regno1" label="RegNo 1">
            <input
              id="cgpa-compare-regno1"
              value={cgpaCompareRegno1}
              onChange={(e) => setCgpaCompareRegno1(e.target.value)}
              placeholder="812823205060"
              className={`${inputCls} min-w-[200px] flex-1`}
            />
          </InputField>
          <InputField id="cgpa-compare-regno2" label="RegNo 2">
            <input
              id="cgpa-compare-regno2"
              value={cgpaCompareRegno2}
              onChange={(e) => setCgpaCompareRegno2(e.target.value)}
              placeholder="812823205023"
              className={`${inputCls} min-w-[200px] flex-1`}
            />
          </InputField>
          <InputField id="cgpa-subject-details" label="Subject Details">
            <select
              id="cgpa-subject-details"
              value={cgpaSubjectDetails ? "yes" : "no"}
              onChange={(e) => setCgpaSubjectDetails(e.target.value === "yes")}
              className={`${inputCls} w-44`}
            >
              <option value="no">Summary only</option>
              <option value="yes">Include details</option>
            </select>
          </InputField>
          <button
            type="submit"
            disabled={cgpaCompare.loading || !canQuery}
            className={btnCls}
          >
            {cgpaCompare.loading ? "Loading…" : "Compare CGPA Profiles"}
          </button>
        </form>

        {cgpaCompare.error && <Notice error>{cgpaCompare.error}</Notice>}

        {compareData && (
          <div className="flex flex-col gap-3">
            <p className="text-sm m-0">
              <strong>{compareData.student1.name}</strong> ({compareData.student1.regno}) vs{" "}
              <strong>{compareData.student2.name}</strong> ({compareData.student2.regno})
            </p>
            <div className={scrollTableClass}>
              <table className="w-full border-collapse">
                <THead
                  cols={[
                    "Metric",
                    `${compareData.student1.regno.slice(-3)} Value`,
                    `${compareData.student2.regno.slice(-3)} Value`,
                    "Diff",
                    `${compareData.student1.regno.slice(-3)} Arrears`,
                    `${compareData.student2.regno.slice(-3)} Arrears`,
                    `${compareData.student1.regno.slice(-3)} Credits`,
                    `${compareData.student2.regno.slice(-3)} Credits`,
                  ]}
                />
                <tbody>
                  {compareData.rows.map((row) => (
                    <tr key={row.metric} className="hover:bg-[#f4f7ff] transition-colors">
                      <Td>{row.metric}</Td>
                      <Td>{fmtMaybe(row.student1_value)}</Td>
                      <Td>{fmtMaybe(row.student2_value)}</Td>
                      <Td>{fmtMaybe(row.diff)}</Td>
                      <Td>{row.student1_arrears}</Td>
                      <Td>{row.student2_arrears}</Td>
                      <Td>{row.student1_credits.toFixed(1)}</Td>
                      <Td>{row.student2_credits.toFixed(1)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {compareData.subject_details.map((detail) => (
              <div
                key={`detail-sem-${detail.semester}`}
                className="border border-[#dbe3ff] rounded-[10px] p-3 flex flex-col gap-2.5"
              >
                <h3 className="m-0 text-[0.95rem] font-bold text-[var(--foreground)]">
                  Semester {detail.semester} Subject Detail
                </h3>
                <div className={scrollTableClass}>
                  <table className="w-full border-collapse">
                    <THead
                      cols={[
                        "Code",
                        "Subject",
                        "Credit",
                        `${compareData.student1.regno.slice(-3)} Grade`,
                        `${compareData.student1.regno.slice(-3)} Credit × GP`,
                        `${compareData.student2.regno.slice(-3)} Grade`,
                        `${compareData.student2.regno.slice(-3)} Credit × GP`,
                        "Diff",
                      ]}
                    />
                    <tbody>
                      {detail.rows.map((row) => (
                        <tr
                          key={`${detail.semester}-${row.code}`}
                          className="hover:bg-[#f4f7ff] transition-colors"
                        >
                          <Td>{row.code}</Td>
                          <Td>{row.name}</Td>
                          <Td>{row.credit.toFixed(1)}</Td>
                          <Td>{row.student1_grade}</Td>
                          <Td>{row.student1_credit_x_gp.toFixed(2)}</Td>
                          <Td>{row.student2_grade}</Td>
                          <Td>{row.student2_credit_x_gp.toFixed(2)}</Td>
                          <Td>{row.diff.toFixed(2)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionBlock>
    </div>
  );
}
