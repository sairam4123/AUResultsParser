"use client";

import { useExplorer } from "../../_explorer/context";
import { fmtNumber } from "../../_explorer/utils";

export default function RankingsPage() {
  const { ranks } = useExplorer();

  return (
    <div className="p-4 overflow-auto max-h-[calc(100vh-180px)]">
      {ranks.loading && <p className="text-sm text-[var(--muted)] m-0">Loading rank list...</p>}
      {ranks.error && <p className="text-sm text-red-700 font-semibold m-0">{ranks.error}</p>}
      {ranks.data && (
        <table className="w-full border-collapse overflow-hidden rounded-[10px]">
          <thead className="bg-[#eef2ff]">
            <tr>
              {["Rank", "Register No", "Name", "SGPA"].map((h) => (
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
            {ranks.data.items.map((item) => (
              <tr key={item.regno} className="hover:bg-[#f4f7ff] transition-colors">
                <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">{item.rank}</td>
                <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">{item.regno}</td>
                <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">{item.name}</td>
                <td className="px-2.5 py-2 text-sm border-b border-[#dbe3ff]">{fmtNumber(item.sgpa)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
