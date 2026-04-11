"use client";

import { useExplorer } from "../../_explorer/context";
import { Notice, ScrollTable, StatTile, Td, trHover } from "../../_explorer/components";

const BUCKETS = ["1", "2", "3+", "4", "5"] as const;

export default function ArrearsPage() {
  const { arrears } = useExplorer();

  return (
    <div className="p-4 overflow-auto max-h-[calc(100vh-150px)] flex flex-col gap-4">
      {arrears.loading && <Notice>Loading arrears snapshot…</Notice>}
      {arrears.error && <Notice error>{arrears.error}</Notice>}
      {arrears.data && (
        <>
          <div className="grid grid-cols-5 gap-2.5">
            {BUCKETS.map((b) => (
              <StatTile key={b} label={`${b} arrear${b === "1" ? "" : "s"}`} value={arrears.data!.counts[b]} />
            ))}
          </div>

          <ScrollTable maxH="max-h-[60vh]" cols={["Register No", "Name", "Arrears"]}>
            {arrears.data.students.map((item) => (
              <tr key={item.regno} className={trHover}>
                <Td>{item.regno}</Td>
                <Td>{item.name}</Td>
                <Td>{item.arrears}</Td>
              </tr>
            ))}
          </ScrollTable>
        </>
      )}
    </div>
  );
}
