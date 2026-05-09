"use client";

import { useEffect, useState } from "react";
import { useExplorer } from "../../_explorer/context";
import { fmtNumber } from "../../_explorer/utils";
import { ClassManager } from "./ClassManager";
import { api, type SubjectSummaryResponse } from "../../../lib/api";

export default function SubjectsPage() {
  const {
    meta,
    subjectSummary: globalSubjectSummary,
    setPageKpi,
    department,
    selectedSemesters,
    batch,
  } = useExplorer();

  const [classRegnos, setClassRegnos] = useState<string[] | null>(null);
  const [localSummary, setLocalSummary] = useState<{
    loading: boolean;
    error: string | null;
    data: SubjectSummaryResponse | null;
  } | null>(null);

  const activeSemester = selectedSemesters[0] ?? 0;

  const defaultPrefix = "8128" + 
    (batch ? batch.slice(-2) : "") + 
    (meta.data?.departments.find(d => d.name === department)?.code || "");

  useEffect(() => {
    if (!classRegnos || !activeSemester || !department) {
      setLocalSummary(null);
      return;
    }

    let isMounted = true;
    setLocalSummary({ loading: true, error: null, data: null });

    api
      .getSubjectSummary(
        activeSemester,
        department,
        batch || null,
        classRegnos.join(","),
      )
      .then((data) => {
        if (isMounted) setLocalSummary({ loading: false, error: null, data });
      })
      .catch((error) => {
        if (isMounted) {
          setLocalSummary({
            loading: false,
            error: error instanceof Error ? error.message : "Load failed",
            data: null,
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [classRegnos, activeSemester, department, batch]);

  const subjectSummary = classRegnos
    ? localSummary || { loading: true, error: null, data: null }
    : globalSubjectSummary;

  useEffect(() => {
    if (!subjectSummary.data || subjectSummary.data.subjects.length === 0) {
      setPageKpi(null);
      return;
    }

    const subs = subjectSummary.data.subjects;
    const totalAppeared = subs.reduce((acc, s) => acc + s.appeared, 0);
    const totalPassed = subs.reduce((acc, s) => acc + s.passed, 0);
    const totalFailed = subs.reduce((acc, s) => acc + s.failed, 0);
    const avgPassPct =
      totalAppeared > 0 ? (totalPassed / totalAppeared) * 100 : 0;

    const sortedByFailed = [...subs].sort((a, b) => b.failed - a.failed);
    const sortedByPassPct = [...subs].sort(
      (a, b) => a.pass_percentage - b.pass_percentage,
    );

    const perfectSubjects = subs.filter((s) => s.failed === 0);

    setPageKpi({
      title: "Subject Insights",
      cards: [
        {
          label: "Active Subjects",
          value: subs.length.toString(),
        },
        {
          label: "Overall Pass Rate",
          value: `${fmtNumber(avgPassPct)}%`,
          suffix: ` (${totalAppeared} Papers)`,
        },
        {
          label: "Perfect Subjects",
          value: perfectSubjects.length.toString(),
          suffix: ` (100% Pass Rate)`,
        },
        ...(sortedByPassPct.length > 0 && sortedByPassPct[0].failed > 0
          ? [
              {
                label: "Hardest Subject",
                value: sortedByPassPct[0].code,
                suffix: ` (${fmtNumber(sortedByPassPct[0].pass_percentage)}% Pass)`,
              },
            ]
          : []),
        ...(sortedByFailed.length > 0 &&
        sortedByFailed[0].failed > 0 &&
        sortedByFailed[0].code !== sortedByPassPct[0]?.code
          ? [
              {
                label: "Most Arrears In",
                value: sortedByFailed[0].code,
                suffix: ` (${sortedByFailed[0].failed} Students)`,
              },
            ]
          : []),
      ],
    });
  }, [subjectSummary.data, setPageKpi]);

  return (
    <div className="p-4 overflow-auto max-h-[calc(100vh-180px)]">
      <ClassManager onSelectClass={setClassRegnos} defaultPrefix={defaultPrefix} />
      
      {subjectSummary.loading && (
        <p className="text-sm text-[var(--muted)] m-0">
          Loading subject metrics...
        </p>
      )}
      {subjectSummary.error && (
        <p className="text-sm text-red-700 font-semibold m-0">
          {subjectSummary.error}
        </p>
      )}
      {subjectSummary.data && (
        <table className="w-full border-collapse rounded-[10px] overflow-hidden">
          <thead className="bg-[#eef2ff]">
            <tr>
              {[
                "Code",
                "Subject",
                "Appeared",
                "Passed",
                "Failed",
                "Pass %",
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
            {subjectSummary.data.subjects.map((item) => (
              <tr
                key={item.code}
                className="hover:bg-[#f4f7ff] transition-colors"
              >
                <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                  {item.code}
                </td>
                <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                  {item.name}
                </td>
                <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                  {item.appeared}
                </td>
                <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                  {item.passed}
                </td>
                <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                  {item.failed}
                </td>
                <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                  {fmtNumber(item.pass_percentage)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
