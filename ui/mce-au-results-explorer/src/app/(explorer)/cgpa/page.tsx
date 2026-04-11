"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Select from "react-select";
import { api, type CgpaClassResponse } from "../../../lib/api";
import { useExplorer } from "../../_explorer/context";
import { initialDataState, type DataState } from "../../_explorer/types";
import { fmtMaybe, parseSemestersInput } from "../../_explorer/utils";
import {
  btnPrimary,
  btnSecondary,
  InputField,
  inputCls,
  Notice,
  SectionBlock,
  SectionHead,
  ScrollTable,
  Td,
  trHover,
} from "../../_explorer/components";

type Opt = { value: string; label: string };

const sortOptions: Opt[] = [
  { value: "cgpa", label: "CGPA" },
  { value: "arrears", label: "Arrears" },
  { value: "regno", label: "Reg No" },
];

export default function CgpaPage() {
  const { canQuery, semester, semesters, department, batch } = useExplorer();

  const portalRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { portalRef.current = document.body; setMounted(true); }, []);
  const rsShared = { classNamePrefix: "rs" as const, menuPortalTarget: mounted ? portalRef.current! : undefined, styles: { menuPortal: (base: object) => ({ ...base, zIndex: 9999 }) } } as const;

  const [semestersInput, setSemestersInput] = useState("3,4,5");

  // Sync with top filter bar
  useEffect(() => {
    if (semesters.length > 0) setSemestersInput(semesters.join(","));
  }, [semesters]);
  const [cgpaSortBy, setCgpaSortBy] = useState<Opt>(sortOptions[0]);
  const [cgpaTopInput, setCgpaTopInput] = useState("50");
  const [cgpaRegnoFilter, setCgpaRegnoFilter] = useState("");
  const [cgpaClass, setCgpaClass] = useState<DataState<CgpaClassResponse>>(initialDataState);

  const cgpaRankByRegno = useMemo(() => {
    const map = new Map<string, number | null>();
    if (!cgpaClass.data) return map;
    const ranked = [...cgpaClass.data.rows].sort((l, r) => {
      if (l.cgpa == null && r.cgpa == null) return l.regno.localeCompare(r.regno);
      if (l.cgpa == null) return 1;
      if (r.cgpa == null) return -1;
      if (r.cgpa !== l.cgpa) return r.cgpa - l.cgpa;
      if (l.arrears !== r.arrears) return l.arrears - r.arrears;
      return l.regno.localeCompare(r.regno);
    });
    ranked.forEach((row, i) => map.set(row.regno, row.cgpa == null ? null : i + 1));
    return map;
  }, [cgpaClass.data]);

  const onLoad = async (e: FormEvent) => {
    e.preventDefault();
    if (!canQuery) return;

    const normalizedSemesters = parseSemestersInput(semestersInput);
    if (!normalizedSemesters) {
      setCgpaClass({ loading: false, error: "Enter valid semesters like 3,4,5.", data: null });
      return;
    }

    setCgpaClass({ loading: true, error: null, data: null });

    const top = Math.floor(Number(cgpaTopInput.trim()));

    try {
      const payload = await api.getCgpaClass({
        semesters: normalizedSemesters,
        department,
        batch: batch || null,
        regno: cgpaRegnoFilter.trim() || undefined,
        sortBy: cgpaSortBy.value as "cgpa" | "arrears" | "regno",
        top: Number.isFinite(top) && top > 0 ? top : undefined,
      });
      setCgpaClass({ loading: false, error: null, data: payload });
    } catch (err) {
      setCgpaClass({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load CGPA class",
        data: null,
      });
    }
  };

  return (
    <div className="p-4 overflow-auto max-h-[calc(100vh-150px)] flex flex-col gap-4">
      {!canQuery && <Notice>Select department and semester to run CGPA analytics.</Notice>}

      <SectionBlock>
        <SectionHead
          title="Class CGPA Ranking"
          description="Default ranking: CGPA desc → arrears asc → regno asc."
        />

        <form onSubmit={onLoad} className="flex flex-wrap items-end gap-3">
          <InputField id="cgpa-semesters" label="Semesters" hint="Comma-separated, e.g. 3,4,5">
            <input
              id="cgpa-semesters"
              value={semestersInput}
              onChange={(e) => setSemestersInput(e.target.value)}
              placeholder="3,4,5"
              className={inputCls}
            />
          </InputField>

          <button
            type="button"
            className={`${btnSecondary} self-end`}
            onClick={() => setSemestersInput(String(semester))}
          >
            Use Sem {semester}
          </button>

          <InputField id="cgpa-sort" label="Sort By" className="w-40 flex-none">
            <Select<Opt>
              {...rsShared}
              inputId="cgpa-sort"
              isSearchable={false}
              options={sortOptions}
              value={cgpaSortBy}
              onChange={(opt) => opt && setCgpaSortBy(opt)}
            />
          </InputField>

          <InputField id="cgpa-top" label="Limit" className="w-28 flex-none">
            <input
              id="cgpa-top"
              type="number"
              min={1}
              value={cgpaTopInput}
              onChange={(e) => setCgpaTopInput(e.target.value)}
              className={inputCls}
            />
          </InputField>

          <InputField id="cgpa-filter" label="RegNo Filter (optional)" className="flex-1 min-w-[180px]">
            <input
              id="cgpa-filter"
              value={cgpaRegnoFilter}
              onChange={(e) => setCgpaRegnoFilter(e.target.value)}
              placeholder="812823205060"
              className={inputCls}
            />
          </InputField>

          <button type="submit" disabled={cgpaClass.loading || !canQuery} className={`${btnPrimary} self-end`}>
            {cgpaClass.loading ? "Running…" : "Build Rankings"}
          </button>
        </form>

        {cgpaClass.error && <Notice error>{cgpaClass.error}</Notice>}

        {cgpaClass.data && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-slate-600 m-0">
              Students: <strong>{cgpaClass.data.summary.students_considered}</strong> · Avg CGPA:{" "}
              <strong>{cgpaClass.data.summary.average_cgpa.toFixed(2)}</strong> · Total Arrears:{" "}
              <strong>{cgpaClass.data.summary.total_arrears}</strong> · No Arrears:{" "}
              <strong>{cgpaClass.data.summary.students_without_arrears}</strong>
            </p>

            <ScrollTable
              maxH="max-h-[60vh]"
              cols={[
                "Reg No",
                "Name",
                "CGPA Rank",
                ...cgpaClass.data.semesters.map((s) => `S${s} SGPA`),
                "CGPA",
                "Arrears",
                "Credits",
              ]}
            >
              {cgpaClass.data.rows.map((row) => (
                <tr key={row.regno} className={trHover}>
                  <Td>{row.regno}</Td>
                  <Td>{row.name}</Td>
                  <Td>{cgpaRankByRegno.get(row.regno) ?? "N/A"}</Td>
                  {cgpaClass.data?.semesters.map((sem) => (
                    <Td key={`${row.regno}-s${sem}`}>
                      {fmtMaybe(row.semester_sgpa[String(sem)] ?? null)}
                    </Td>
                  ))}
                  <Td>{fmtMaybe(row.cgpa)}</Td>
                  <Td>{row.arrears}</Td>
                  <Td>{row.credits.toFixed(1)}</Td>
                </tr>
              ))}
              {cgpaClass.data.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7 + cgpaClass.data.semesters.length}
                    className="px-2.5 py-4 text-sm text-center text-[var(--muted)]"
                  >
                    No students found for this filter.
                  </td>
                </tr>
              )}
            </ScrollTable>
          </div>
        )}
      </SectionBlock>
    </div>
  );
}
