"use client";

import { useExplorer } from "../../_explorer/context";
import { fmtNumber } from "../../_explorer/utils";

export default function SubjectsPage() {
  const { subjectSummary } = useExplorer();

  return (
    <div className="p-4 overflow-auto max-h-[calc(100vh-180px)]">
      {subjectSummary.loading && (
        <p className="text-sm text-[var(--muted)] m-0">Loading subject metrics...</p>
      )}
      {subjectSummary.error && (
        <p className="text-sm text-red-700 font-semibold m-0">{subjectSummary.error}</p>
      )}
      {subjectSummary.data && (
        <table className="w-full border-collapse rounded-[10px] overflow-hidden">
          <thead className="bg-[#eef2ff]">
            <tr>
              {["Code", "Subject", "Appeared", "Passed", "Failed", "Pass %"].map((h) => (
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
              <tr key={item.code} className="hover:bg-[#f4f7ff] transition-colors">
                <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">{item.code}</td>
                <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">{item.name}</td>
                <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">{item.appeared}</td>
                <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">{item.passed}</td>
                <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">{item.failed}</td>
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
