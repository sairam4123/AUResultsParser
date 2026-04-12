"use client";

import { useExplorer } from "../../_explorer/context";
import { fmtNumber } from "../../_explorer/utils";

export default function OverviewPage() {
  const { summary } = useExplorer();

  return (
    <div className="p-5">
      <p className="text-base font-bold text-[var(--foreground)] mb-3">Semester snapshot</p>
      {summary.loading && <p className="text-sm text-[var(--muted)] m-0">Refreshing summary...</p>}
      {summary.error && <p className="text-sm text-red-700 font-semibold m-0">{summary.error}</p>}
      {summary.data && (
        <div className="grid grid-cols-3 gap-3">
          <div className="border border-dashed border-[#c6ceef] rounded-[10px] bg-[#f7f9ff] px-3 py-2.5">
            <strong className="block text-[0.73rem] uppercase tracking-[0.05em] font-[650] text-[var(--muted)]">
              One arrear
            </strong>
            <p className="m-0 mt-1 text-[1.2rem] font-bold text-[var(--foreground)]">
              {fmtNumber(summary.data.summary.one_arrear)}
            </p>
          </div>
          <div className="border border-dashed border-[#c6ceef] rounded-[10px] bg-[#f7f9ff] px-3 py-2.5">
            <strong className="block text-[0.73rem] uppercase tracking-[0.05em] font-[650] text-[var(--muted)]">
              Two arrears
            </strong>
            <p className="m-0 mt-1 text-[1.2rem] font-bold text-[var(--foreground)]">
              {fmtNumber(summary.data.summary.two_arrears)}
            </p>
          </div>
          <div className="border border-dashed border-[#c6ceef] rounded-[10px] bg-[#f7f9ff] px-3 py-2.5">
            <strong className="block text-[0.73rem] uppercase tracking-[0.05em] font-[650] text-[var(--muted)]">
              Three+ arrears
            </strong>
            <p className="m-0 mt-1 text-[1.2rem] font-bold text-[var(--foreground)]">
              {fmtNumber(summary.data.summary["three+_arrears"])}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
