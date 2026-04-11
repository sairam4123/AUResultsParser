"use client";

import { useExplorer } from "../../_explorer/context";
import { fmtNumber } from "../../_explorer/utils";
import { Notice, ScrollTable, Td, trHover } from "../../_explorer/components";

export default function SubjectsPage() {
  const { subjectSummary } = useExplorer();

  return (
    <div className="p-4 overflow-auto max-h-[calc(100vh-150px)]">
      {subjectSummary.loading && <Notice>Loading subject metrics…</Notice>}
      {subjectSummary.error && <Notice error>{subjectSummary.error}</Notice>}
      {subjectSummary.data && (
        <ScrollTable
          maxH="max-h-[70vh]"
          cols={["Code", "Subject", "Appeared", "Passed", "Failed", "Pass %"]}
        >
          {subjectSummary.data.subjects.map((item) => (
            <tr key={item.code} className={trHover}>
              <Td>{item.code}</Td>
              <Td>{item.name}</Td>
              <Td>{item.appeared}</Td>
              <Td>{item.passed}</Td>
              <Td>{item.failed}</Td>
              <Td>{fmtNumber(item.pass_percentage)}%</Td>
            </tr>
          ))}
        </ScrollTable>
      )}
    </div>
  );
}
