"use client";

import { type FormEvent, useMemo, useState } from "react";
import Select, { type MultiValue } from "react-select";
import { api } from "../../../lib/api";
import { useExplorer } from "../../_explorer/context";
import {
  initialDataState,
  type DataState,
  type StudentOption,
  type SubjectComparisonTable,
} from "../../_explorer/types";
import { buildSubjectComparisonTable } from "../../_explorer/utils";

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

export default function ComparisonsPage() {
  const { canQuery, semester, department, batch, studentsDirectory } = useExplorer();
  const [selectedStudents, setSelectedStudents] = useState<StudentOption[]>([]);
  const [subjectComparison, setSubjectComparison] = useState<DataState<SubjectComparisonTable>>(
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
      return;
    }
    if (selectedStudents.length > 12) {
      setSubjectComparison({
        loading: false,
        error: "Comparison supports up to 12 students.",
        data: null,
      });
      return;
    }

    setSubjectComparison({ loading: true, error: null, data: null });

    try {
      const studentResults = await Promise.all(
        selectedStudents.map((item) =>
          api.getStudent(semester, department, batch || null, item.value),
        ),
      );
      const table = buildSubjectComparisonTable(studentResults.map((r) => r.student));
      setSubjectComparison({ loading: false, error: null, data: table });
    } catch (error) {
      setSubjectComparison({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to build subject comparison",
        data: null,
      });
    }
  };

  return (
    <div className="p-4 overflow-auto max-h-[calc(100vh-180px)] flex flex-col gap-4">
      {!canQuery && (
        <p className="text-sm text-[var(--muted)] m-0">
          Select department and semester to run comparisons.
        </p>
      )}

      <div className="border border-[#dbe3ff] rounded-[14px] p-4 bg-[#f9fbff] flex flex-col gap-3">
        {/* Header */}
        <div>
          <h3 className="m-0 text-[1rem] font-bold text-[var(--foreground)]">
            Multi-Student Subject Comparison
          </h3>
          <p className="m-0 text-[0.8rem] text-slate-500">
            Compare 2 to 12 students for subject-wise grade-point spread in the selected semester.
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
              onChange={(options: MultiValue<StudentOption>) =>
                setSelectedStudents([...options])
              }
              isMulti
              isLoading={studentsDirectory.loading}
              placeholder="Type and select multiple students…"
              classNamePrefix="rs"
            />
            <p className="text-xs text-slate-500 m-0">
              Directory size: {studentOptions.length} students
            </p>
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
            {subjectComparison.loading ? "Comparing…" : "Generate Subject Comparison"}
          </button>
        </form>

        {subjectComparison.error && (
          <p className="text-sm font-semibold text-red-700 m-0">{subjectComparison.error}</p>
        )}

        {subjectComparison.data ? (
          <div className="border border-[#dbe3ff] rounded-[10px] p-3 flex flex-col gap-3">
            <div className="overflow-auto">
              <table className="w-full border-collapse">
                <THead cols={subjectComparison.data.headers} />
                <tbody>
                  {subjectComparison.data.rows.map((row) => (
                    <tr key={row.subjectCode} className="hover:bg-[#f4f7ff] transition-colors">
                      <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                        {row.subjectCode}
                      </td>
                      <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                        {row.subjectName || "–"}
                      </td>
                      {row.points.map((cell, index) => (
                        <td
                          key={`${row.subjectCode}-p-${index}`}
                          className={`px-2.5 py-2 text-sm border-b border-[#dbe3ff] ${
                            cell.diff > 0
                              ? "text-green-800 font-semibold"
                              : "text-slate-500"
                          }`}
                        >
                          <span>{cell.value}</span>
                          {cell.diff > 0 && (
                            <span className="ml-1 text-xs">(+{cell.diff})</span>
                          )}
                        </td>
                      ))}
                      <td
                        className={`px-2.5 py-2 text-sm border-b border-[#dbe3ff] ${
                          row.spread > 0 ? "text-sky-700 font-semibold" : "text-slate-400"
                        }`}
                      >
                        {row.spread > 0 ? `+${row.spread}` : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {subjectComparison.data.footer.length > 0 && (
              <div className="border-t border-dashed border-[#d7dff7] pt-2.5 flex flex-col gap-1.5">
                {subjectComparison.data.footer.map((note) => (
                  <p key={note} className="text-sm text-slate-600 m-0">
                    {note}
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 m-0">
            No comparison generated yet. Select students and click Generate Subject Comparison.
          </p>
        )}
      </div>
    </div>
  );
}
