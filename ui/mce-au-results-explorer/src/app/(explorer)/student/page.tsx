"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, type FormEvent, useMemo, useState } from "react";
import {
  api,
  type CgpaBreakdownResponse,
  type StudentAuditResponse,
  type StudentResponse,
} from "../../../lib/api";
import { useExplorer } from "../../_explorer/context";
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

const ScrollTable = ({ cols, children }: { cols: string[]; children: React.ReactNode }) => (
  <div className="overflow-auto max-h-64 border border-[#dbe3ff] rounded-[10px]">
    <table className="w-full border-collapse">
      <THead cols={cols} />
      <tbody>{children}</tbody>
    </table>
  </div>
);

const ResultBlock = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border border-[#dbe3ff] rounded-[14px] p-4 bg-[#fffefb] flex flex-col gap-3">
    <p className="text-[0.95rem] font-bold m-0 text-[var(--foreground)]">{title}</p>
    {children}
  </div>
);

const Notice = ({ error, children }: { error?: boolean; children: React.ReactNode }) => (
  <p className={`text-sm m-0 ${error ? "text-red-700 font-semibold" : "text-[var(--muted)]"}`}>
    {children}
  </p>
);

// ── Page content ───────────────────────────────────────────

function StudentPageContent() {
  const { canQuery, semester, department, batch, meta } = useExplorer();
  const searchParams = useSearchParams();
  const [regnoInput, setRegnoInput] = useState<string>(
    () => searchParams.get("regno")?.trim() ?? "",
  );
  const [student, setStudent] = useState<DataState<StudentResponse>>(initialDataState);
  const [studentAudit, setStudentAudit] = useState<DataState<StudentAuditResponse>>(
    initialDataState,
  );
  const [cgpaBreakdown, setCgpaBreakdown] = useState<DataState<CgpaBreakdownResponse>>(
    initialDataState,
  );

  const selectedSemesterBreakdown = useMemo(() => {
    if (!cgpaBreakdown.data) return null;
    return (
      cgpaBreakdown.data.semesters.find((item) => item.semester === semester) ??
      cgpaBreakdown.data.semesters[cgpaBreakdown.data.semesters.length - 1] ??
      null
    );
  }, [cgpaBreakdown.data, semester]);

  const subjectAuditTrail = useMemo(() => {
    if (!studentAudit.data) return [];
    return [...studentAudit.data.events].sort((l, r) => {
      const diff =
        new Date(r.result_date).getTime() - new Date(l.result_date).getTime();
      return diff !== 0 ? diff : l.recency_rank - r.recency_rank;
    });
  }, [studentAudit.data]);

  const lookupStudent = async (rawRegno: string) => {
    if (!canQuery) return;
    const regno = rawRegno.trim();
    if (!regno) {
      setStudent({ loading: false, error: "Enter a register number", data: null });
      return;
    }
    setStudent({ loading: true, error: null, data: null });
    setStudentAudit({ loading: true, error: null, data: null });
    setCgpaBreakdown({ loading: true, error: null, data: null });

    const semestersCsv =
      meta.data?.semesters.length && meta.data.semesters.length > 0
        ? meta.data.semesters.join(",")
        : String(semester);

    const [studentResult, auditResult, cgpaResult] = await Promise.allSettled([
      api.getStudent(semester, department, batch || null, regno),
      api.getStudentAudit(semester, department, batch || null, regno),
      api.getCgpaBreakdown({ semesters: semestersCsv, department, batch: batch || null, regno }),
    ]);

    if (studentResult.status === "fulfilled") {
      setStudent({ loading: false, error: null, data: studentResult.value });
    } else {
      const message =
        studentResult.reason instanceof Error ? studentResult.reason.message : "Lookup failed";
      setStudent({ loading: false, error: message, data: null });
    }

    if (auditResult.status === "fulfilled") {
      setStudentAudit({ loading: false, error: null, data: auditResult.value });
    } else {
      const message =
        auditResult.reason instanceof Error
          ? auditResult.reason.message
          : "Audit lookup failed";
      setStudentAudit({ loading: false, error: message, data: null });
    }

    if (cgpaResult.status === "fulfilled") {
      setCgpaBreakdown({ loading: false, error: null, data: cgpaResult.value });
    } else {
      const message =
        cgpaResult.reason instanceof Error
          ? cgpaResult.reason.message
          : "CGPA breakdown lookup failed";
      setCgpaBreakdown({ loading: false, error: message, data: null });
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void lookupStudent(regnoInput);
  };

  return (
    <div className="p-4 overflow-auto max-h-[calc(100vh-180px)] flex flex-col gap-4">
      {/* Lookup form */}
      <form className="grid grid-cols-[1fr_auto] gap-2.5 items-end" onSubmit={onSubmit}>
        <input
          type="text"
          placeholder="Enter register number"
          value={regnoInput}
          onChange={(e) => setRegnoInput(e.target.value)}
          className="min-h-[40px] px-3 rounded-[10px] border border-[#7f8dd6] bg-white
            text-[var(--foreground)] text-[0.91rem] outline-none
            focus:border-[#3040a0] focus:ring-2 focus:ring-[rgba(48,64,160,0.12)] transition-shadow"
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
          Load Student
        </button>
      </form>

      {!canQuery && <Notice>Select department and semester to query student data.</Notice>}
      {student.loading && <Notice>Loading student profile...</Notice>}
      {student.error && <Notice error>{student.error}</Notice>}

      {student.data && (
        <>
          {/* Student header */}
          <div className="mb-1">
            <h3 className="m-0 mb-1 text-[1.1rem] font-bold text-[var(--foreground)]">
              {student.data.student.name}
            </h3>
            <p className="m-0 text-[var(--muted)] text-sm">
              {student.data.student.regno} • SGPA {fmtNumber(student.data.student.sgpa)} • Rank{" "}
              {student.data.student.rank ?? "–"}
            </p>
          </div>

          {/* Current semester subjects */}
          <ResultBlock title="Current Semester Subject Snapshot">
            <ScrollTable cols={["Code", "Subject", "Grade", "Status", "GP"]}>
              {student.data.student.subjects.map((item) => (
                <tr key={item.code} className="hover:bg-[#f4f7ff] transition-colors">
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
            {cgpaBreakdown.loading && <Notice>Loading CGPA calculations...</Notice>}
            {cgpaBreakdown.error && <Notice error>{cgpaBreakdown.error}</Notice>}
            {cgpaBreakdown.data && (
              <>
                {/* Overall stats */}
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: "Current SGPA", value: fmtMaybe(student.data.student.sgpa) },
                    { label: "Overall CGPA", value: fmtMaybe(cgpaBreakdown.data.overall.cgpa) },
                    { label: "Total Credits", value: cgpaBreakdown.data.overall.credits.toFixed(1) },
                    {
                      label: "Total Grade Points",
                      value: cgpaBreakdown.data.overall.grade_points.toFixed(2),
                    },
                    { label: "Total Arrears", value: String(cgpaBreakdown.data.overall.arrears) },
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
                  <strong>{cgpaBreakdown.data.overall.grade_points.toFixed(2)}</strong> /{" "}
                  <strong>{cgpaBreakdown.data.overall.credits.toFixed(1)}</strong> ={" "}
                  <strong>{fmtMaybe(cgpaBreakdown.data.overall.cgpa)}</strong>
                </p>

                <ScrollTable cols={["Semester", "Credits", "Grade Points", "SGPA", "Arrears"]}>
                  {cgpaBreakdown.data.semesters.map((item) => (
                    <tr key={`sgpa-${item.semester}`} className="hover:bg-[#f4f7ff] transition-colors">
                      <Td>Semester {item.semester}</Td>
                      <Td>{item.totals.credits.toFixed(1)}</Td>
                      <Td>{item.totals.grade_points.toFixed(2)}</Td>
                      <Td>{fmtMaybe(item.totals.sgpa)}</Td>
                      <Td>{item.totals.arrears}</Td>
                    </tr>
                  ))}
                </ScrollTable>

                {selectedSemesterBreakdown && (
                  <>
                    <p className="text-sm text-slate-600 m-0">
                      Semester {selectedSemesterBreakdown.semester} SGPA ={" "}
                      <strong>{selectedSemesterBreakdown.totals.grade_points.toFixed(2)}</strong> /{" "}
                      <strong>{selectedSemesterBreakdown.totals.credits.toFixed(1)}</strong> ={" "}
                      <strong>{fmtMaybe(selectedSemesterBreakdown.totals.sgpa)}</strong>
                    </p>
                    <ScrollTable
                      cols={["Code", "Subject", "Grade", "Credit", "GP", "Credit × GP", "Included"]}
                    >
                      {selectedSemesterBreakdown.subjects.map((item) => (
                        <tr
                          key={`subject-calc-${selectedSemesterBreakdown.semester}-${item.code}`}
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
                  </>
                )}
              </>
            )}
          </ResultBlock>

          {/* Audit Trail */}
          <ResultBlock title="Audit Trail Timeline">
            {studentAudit.loading && <Notice>Loading audit trail...</Notice>}
            {studentAudit.error && <Notice error>{studentAudit.error}</Notice>}
            {studentAudit.data && (
              <>
                <ScrollTable
                  cols={[
                    "Subject",
                    "State",
                    "Grade",
                    "Result Date",
                    "Exam",
                    "Semester Label",
                    "Recency Rank",
                  ]}
                >
                  {subjectAuditTrail.map((event) => (
                    <tr
                      key={`${event.exam_id}-${event.subject_code}-${event.grade}-${event.result_date}-${event.recency_rank}`}
                      className="hover:bg-[#f4f7ff] transition-colors"
                    >
                      <Td>
                        {event.subject_code} – {event.subject_name}
                      </Td>
                      <Td>{event.state}</Td>
                      <Td>{event.grade}</Td>
                      <Td>{event.result_date}</Td>
                      <Td>{event.exam_name}</Td>
                      <Td>{event.sem_name}</Td>
                      <Td>{event.recency_rank}</Td>
                    </tr>
                  ))}
                </ScrollTable>

                <ResultBlock title="Effective Subjects (Final Audit Output)">
                  <ScrollTable cols={["Code", "Subject", "Effective Grade", "Status", "GP"]}>
                    {studentAudit.data.effective_subjects.map((item) => (
                      <tr key={item.code} className="hover:bg-[#f4f7ff] transition-colors">
                        <Td>{item.code}</Td>
                        <Td>{item.name}</Td>
                        <Td>{item.grade}</Td>
                        <Td>{item.status}</Td>
                        <Td>{gradePointMap[item.grade] ?? 0}</Td>
                      </tr>
                    ))}
                  </ScrollTable>
                </ResultBlock>
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
          <p className="text-sm text-[var(--muted)] m-0">Loading student tools...</p>
        </div>
      }
    >
      <StudentPageContent />
    </Suspense>
  );
}
