"use client";

import { type FormEvent, useState } from "react";
import { api, type StudentAuditResponse } from "../../../lib/api";
import { useExplorer } from "../../_explorer/context";
import { initialDataState, type DataState } from "../../_explorer/types";
import {
  btnPrimary,
  inputCls,
  Notice,
  SectionBlock,
  SectionHead,
} from "../../_explorer/components";

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Pass: "bg-green-100 text-green-800",
  Fail: "bg-red-100 text-red-800",
  Active: "bg-blue-100 text-blue-800",
  Superseded: "bg-slate-100 text-slate-500 line-through",
  Withheld: "bg-amber-100 text-amber-800",
};

const GRADE_COLORS: Record<string, string> = {
  O: "text-[#3040a0] font-bold",
  "A+": "text-[#3040a0]",
  A: "text-green-800",
  "B+": "text-green-700",
  B: "text-lime-700",
  C: "text-amber-700",
  U: "text-red-700 font-bold",
  UA: "text-red-600",
  NA: "text-slate-400",
  NC: "text-slate-400",
};

// ── Types ──────────────────────────────────────────────────────────────────

type SubjectTimeline = {
  code: string;
  name: string;
  events: StudentAuditResponse["events"];
  effectiveGrade: string;
  effectiveStatus: string;
};

type AuditPerSemester = {
  semester: number;
  name: string;
  sgpa: number | null;
  subjects: SubjectTimeline[];
};

function buildAuditView(
  audits: { semester: number; data: StudentAuditResponse }[],
): AuditPerSemester[] {
  return audits
    .sort((a, b) => a.semester - b.semester)
    .map(({ semester, data }) => {
      // Group events by subject code
      const byCode = new Map<string, StudentAuditResponse["events"]>();
      for (const ev of data.events) {
        const list = byCode.get(ev.subject_code) ?? [];
        list.push(ev);
        byCode.set(ev.subject_code, list);
      }

      // Build subject timelines
      const subjects: SubjectTimeline[] = [];
      for (const eff of data.effective_subjects) {
        const events = (byCode.get(eff.code) ?? []).sort(
          (a, b) => a.recency_rank - b.recency_rank,
        );
        subjects.push({
          code: eff.code,
          name: eff.name,
          events,
          effectiveGrade: eff.grade,
          effectiveStatus: eff.status,
        });
      }

      // Add subjects that have events but aren't in effective_subjects
      const effCodes = new Set(data.effective_subjects.map((e) => e.code));
      for (const [code, events] of byCode) {
        if (!effCodes.has(code)) {
          const sorted = events.sort((a, b) => a.recency_rank - b.recency_rank);
          subjects.push({
            code,
            name: sorted[0]?.subject_name ?? code,
            events: sorted,
            effectiveGrade: sorted[0]?.grade ?? "–",
            effectiveStatus: sorted[0]?.state ?? "–",
          });
        }
      }

      subjects.sort((a, b) => a.code.localeCompare(b.code));
      return { semester, name: data.name, sgpa: data.sgpa, subjects };
    });
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const { canQuery, meta, semesters, department, batch } = useExplorer();

  const [regnoInput, setRegnoInput] = useState("");
  const [audit, setAudit] = useState<DataState<AuditPerSemester[]>>(initialDataState);

  const onLoad = async (e: FormEvent) => {
    e.preventDefault();
    if (!canQuery) return;
    const regno = regnoInput.trim();
    if (!regno) {
      setAudit({ loading: false, error: "Enter a register number.", data: null });
      return;
    }

    // Use all available semesters or the selected ones
    const semList =
      semesters.length > 0
        ? [...semesters].sort((a, b) => a - b)
        : meta.data?.semesters.sort((a, b) => a - b) ?? [];

    if (semList.length === 0) {
      setAudit({ loading: false, error: "No semesters available.", data: null });
      return;
    }

    setAudit({ loading: true, error: null, data: null });

    try {
      const results = await Promise.allSettled(
        semList.map((sem) =>
          api.getStudentAudit(sem, department, batch || null, regno),
        ),
      );

      const audits: { semester: number; data: StudentAuditResponse }[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          audits.push({ semester: semList[i], data: r.value });
        }
      });

      if (audits.length === 0) {
        setAudit({ loading: false, error: "No audit data found for this student in the selected semesters.", data: null });
        return;
      }

      setAudit({ loading: false, error: null, data: buildAuditView(audits) });
    } catch (err) {
      setAudit({
        loading: false,
        error: err instanceof Error ? err.message : "Audit lookup failed",
        data: null,
      });
    }
  };

  return (
    <div className="p-4 overflow-auto max-h-[calc(100vh-150px)] flex flex-col gap-4">
      <form className="flex items-end gap-2.5" onSubmit={onLoad}>
        <input
          type="text"
          placeholder="Enter register number for audit trail"
          value={regnoInput}
          onChange={(e) => setRegnoInput(e.target.value)}
          className={`${inputCls} flex-1`}
        />
        <button
          type="submit"
          disabled={!canQuery || audit.loading}
          className={`${btnPrimary} shrink-0`}
        >
          {audit.loading ? "Loading…" : "Load Audit Trail"}
        </button>
      </form>

      {!canQuery && <Notice>Select department and semesters to load audit data.</Notice>}
      {audit.loading && <Notice>Fetching audit trail across semesters…</Notice>}
      {audit.error && <Notice error>{audit.error}</Notice>}

      {/* ── Semester-by-semester subject audit ─────────────────────── */}
      {audit.data && (
        <div className="flex flex-col gap-5">
          {/* Profile header */}
          <div className="border border-[var(--panel-border)] rounded-[12px] bg-[#f7f9ff] px-4 py-3">
            <h3 className="m-0 mb-0.5 text-[1.1rem] font-bold text-[var(--foreground)]">
              {audit.data[0]?.name ?? "Student"}
            </h3>
            <p className="m-0 text-[0.85rem] text-[var(--muted)] font-mono">
              {regnoInput.trim().toUpperCase()}
            </p>
          </div>

          {/* Side-by-side grid: one column per semester */}
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${Math.min(audit.data.length, 4)}, minmax(280px, 1fr))`,
            }}
          >
            {audit.data.map(({ semester, sgpa, subjects }) => (
              <SectionBlock key={semester}>
                <SectionHead
                  title={`Semester ${semester}`}
                  description={`${subjects.length} subjects${
                    sgpa !== null ? ` · SGPA ${sgpa.toFixed(2)}` : ""
                  }`}
                />

                <div className="flex flex-col gap-2.5">
                  {subjects.map((subj) => (
                    <div
                      key={subj.code}
                      className="border border-[#dbe3ff] rounded-[10px] bg-white p-2.5 flex flex-col gap-1.5"
                    >
                      {/* Subject header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="m-0 text-[0.78rem] font-bold text-[var(--foreground)] leading-tight">
                            {subj.code}
                          </p>
                          <p className="m-0 text-[0.68rem] text-[var(--muted)] leading-snug truncate">
                            {subj.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {subj.events.length > 0 && subj.events[0].state === "REVAL" && (
                            <span className="text-[0.66rem] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                              REVAL
                            </span>
                          )}
                          {subj.events.length > 0 && subj.events[0].state === "CHALLENGE" && (
                            <span className="text-[0.66rem] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">
                              CHALLENGE
                            </span>
                          )}
                          <span
                            className={`text-[0.72rem] font-bold px-1.5 py-0.5 rounded ${
                              STATUS_COLORS[subj.effectiveStatus] ?? "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {subj.effectiveStatus}
                          </span>
                          <span
                            className={`text-[0.85rem] font-bold ${
                              GRADE_COLORS[subj.effectiveGrade] ?? "text-slate-600"
                            }`}
                          >
                            {subj.effectiveGrade}
                          </span>
                        </div>
                      </div>

                      {/* Event timeline */}
                      {subj.events.length > 0 && (
                        <div className="border-l-2 border-[#c6ceef] ml-1.5 pl-2.5 flex flex-col gap-1">
                          {subj.events.map((ev, idx) => {
                            const isLatest = idx === 0;
                            const isSuperseded = !isLatest;
                            
                            let stateBadgeCls = "bg-blue-50 text-blue-600";
                            if (isSuperseded) stateBadgeCls = "bg-slate-50 text-slate-400";
                            else if (ev.state === "REVAL") stateBadgeCls = "bg-purple-100 text-purple-800";
                            else if (ev.state === "CHALLENGE") stateBadgeCls = "bg-orange-100 text-orange-800";

                            return (
                              <div
                                key={`${ev.exam_id}-${ev.subject_code}-${idx}`}
                                className={`flex items-center gap-2 text-[0.68rem] ${
                                  isSuperseded ? "text-slate-400" : "text-slate-700"
                                }`}
                              >
                                {/* Timeline dot */}
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 -ml-[15px] ${
                                    isLatest
                                      ? "bg-[#3040a0] ring-2 ring-[#3040a033]"
                                      : "bg-slate-300"
                                  }`}
                                />
                                <span
                                  className={`font-bold ${
                                    GRADE_COLORS[ev.grade] ?? "text-slate-600"
                                  } ${isSuperseded ? "line-through opacity-60" : ""}`}
                                >
                                  {ev.grade}
                                </span>
                                <span className={isSuperseded ? "line-through" : ""}>
                                  {ev.exam_name}
                                </span>
                                <span className={`px-1 rounded-[4px] text-[0.6rem] font-bold ${stateBadgeCls}`}>
                                  {ev.state}
                                </span>
                                <span className="text-slate-400 ml-auto shrink-0">
                                  {ev.result_date}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {subj.events.length === 0 && (
                        <p className="text-[0.65rem] text-slate-400 m-0 italic">No exam events recorded.</p>
                      )}
                    </div>
                  ))}

                  {subjects.length === 0 && (
                    <p className="text-xs text-slate-400 m-0 italic">No subjects for this semester.</p>
                  )}
                </div>
              </SectionBlock>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
