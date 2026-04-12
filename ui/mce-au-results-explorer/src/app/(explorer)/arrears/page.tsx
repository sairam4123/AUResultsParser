"use client";

import { useMemo } from "react";
import { useExplorer } from "../../_explorer/context";

export default function ArrearsPage() {
  const { arrears } = useExplorer();
  const arrearsData = arrears.data;
  const totalArrears = useMemo(
    () =>
      arrearsData?.students.reduce((sum, item) => sum + item.arrears, 0) ?? 0,
    [arrearsData],
  );

  return (
    <div className="p-4 overflow-auto max-h-[calc(100vh-180px)] flex flex-col gap-4">
      {arrears.loading && (
        <p className="text-sm text-[var(--muted)] m-0">
          Loading arrears snapshot...
        </p>
      )}
      {arrears.error && (
        <p className="text-sm text-red-700 font-semibold m-0">
          {arrears.error}
        </p>
      )}
      {arrearsData && (
        <>
          {/* Bucketed counts */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
            {(["1", "2", "3+", "4", "5"] as const).map((bucket) => (
              <div
                key={bucket}
                className="border border-dashed border-[#c6ceef] rounded-[10px] bg-[#f7f9ff] px-3 py-2.5"
              >
                <strong className="block text-[0.73rem] uppercase tracking-[0.05em] font-[650] text-[var(--muted)]">
                  {bucket}
                </strong>
                <p className="m-0 mt-1 text-[1.15rem] font-bold text-[var(--foreground)]">
                  {arrearsData.counts[bucket]}
                </p>
              </div>
            ))}

            <div className="border border-dashed border-[#c6ceef] rounded-[10px] bg-[#f7f9ff] px-3 py-2.5">
              <strong className="block text-[0.73rem] uppercase tracking-[0.05em] font-[650] text-[var(--muted)]">
                Total
              </strong>
              <p className="m-0 mt-1 text-[1.15rem] font-bold text-[var(--foreground)]">
                {totalArrears}
              </p>
            </div>
          </div>

          {/* Students table */}
          <table className="w-full border-collapse rounded-[10px] overflow-hidden">
            <thead className="bg-[#eef2ff]">
              <tr>
                {["Register No", "Name", "Arrears"].map((h) => (
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
              {arrearsData.students.map((item) => (
                <tr
                  key={item.regno}
                  className="hover:bg-[#f4f7ff] transition-colors"
                >
                  <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                    {item.regno}
                  </td>
                  <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                    {item.name}
                  </td>
                  <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">
                    {item.arrears}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
