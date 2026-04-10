import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Select from "react-select";
import { useOutletContext } from "react-router-dom";
import {
  getArrearStudents,
  getRankList,
  getStudent,
  getStudentsDirectory,
} from "../api/client";
import type { LayoutOutletContext } from "../layout/layoutContext";
import type { Student, StudentDirectoryItem } from "../types/api";
import { exportMultiPageTablesPdf, exportSingleTablePdf } from "../utils/pdf";

type Option = {
  value: string;
  label: string;
};

type ArrearTab = "1" | "2" | "3+" | "4" | "5";

type PointCell = {
  value: number;
  diff: number;
};

type ComparisonRow = {
  subjectCode: string;
  subjectName: string;
  points: PointCell[];
  spread: number;
};

type ComparisonTable = {
  headers: string[];
  rows: ComparisonRow[];
  footer: string[];
};

const allTabs: ArrearTab[] = ["1", "2", "3+", "4", "5"];
const tabLabel: Record<ArrearTab, string> = {
  "1": "1 Arrear",
  "2": "2 Arrears",
  "3+": "3+ Arrears",
  "4": "Exactly 4",
  "5": "Exactly 5",
};

const gradePointMap: Record<string, number> = {
  O: 10,
  "A+": 9,
  A: 8,
  "B+": 7,
  B: 6,
  C: 5,
  U: 0,
  UA: 0,
  NA: 0,
};

const toOption = (item: StudentDirectoryItem): Option => ({
  value: item.regno,
  label: `${item.name} (${item.regno})`,
});

const shortLabel = (student: Student) => {
  const suffix = student.regno.slice(-3);
  return `${student.name} (${suffix})`;
};

const formatPointWithDiff = (cell: PointCell) => {
  if (cell.diff <= 0) {
    return String(cell.value);
  }
  return `${cell.value} (+${cell.diff})`;
};

const buildComparisonTable = (students: Student[]): ComparisonTable => {
  const subjectMap = new Map<string, string>();
  const studentSubjectMap = students.map((student) => {
    const map = new Map<string, string>();
    student.subjects.forEach((subject) => {
      map.set(subject.code, subject.grade);
      if (!subjectMap.has(subject.code)) {
        subjectMap.set(subject.code, subject.name);
      }
    });
    return map;
  });

  const subjectCodes = Array.from(subjectMap.keys()).sort();

  const rows: ComparisonRow[] = subjectCodes.map((subjectCode) => {
    const points = studentSubjectMap.map((subjectGrades) => {
      const grade = subjectGrades.get(subjectCode) ?? "NA";
      return gradePointMap[grade] ?? 0;
    });

    const minPoint = Math.min(...points);
    const maxPoint = Math.max(...points);

    return {
      subjectCode,
      subjectName: subjectMap.get(subjectCode) ?? "N/A",
      points: points.map((value) => ({ value, diff: value - minPoint })),
      spread: maxPoint - minPoint,
    };
  });

  const totalPoints = students.map((student) =>
    student.subjects.reduce(
      (sum, subject) => sum + (gradePointMap[subject.grade] ?? 0),
      0,
    ),
  );

  const minTotal = Math.min(...totalPoints);
  const maxTotal = Math.max(...totalPoints);

  rows.push({
    subjectCode: "Total GP",
    subjectName: "",
    points: totalPoints.map((value) => ({ value, diff: value - minTotal })),
    spread: maxTotal - minTotal,
  });

  const headers = [
    "Subject",
    "Subject Name",
    ...students.map((student) => shortLabel(student)),
    "Spread",
  ];

  const footer = students.map(
    (student) => `SGPA ${student.regno}: ${student.sgpa.toFixed(2)}`,
  );

  return { headers, rows, footer };
};

export function ExportsPage() {
  const { department, semester, batch } =
    useOutletContext<LayoutOutletContext>();
  const menuPortalTarget =
    typeof window !== "undefined" ? document.body : undefined;

  const [studentOptions, setStudentOptions] = useState<Option[]>([]);
  const [studentOption, setStudentOption] = useState<Option | null>(null);
  const [comparisonOptions, setComparisonOptions] = useState<Option[]>([]);
  const [selectedArrearTabs, setSelectedArrearTabs] = useState<ArrearTab[]>([
    "1",
    "2",
    "3+",
  ]);
  const [topK, setTopK] = useState(10);

  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!department || !semester) {
      return;
    }

    let active = true;

    const loadDirectory = async () => {
      setLoadingDirectory(true);
      try {
        const items = await getStudentsDirectory(
          semester,
          department,
          undefined,
          batch,
        );
        if (!active) {
          return;
        }
        setStudentOptions(items.map(toOption));
      } catch {
        if (active) {
          setStudentOptions([]);
        }
      } finally {
        if (active) {
          setLoadingDirectory(false);
        }
      }
    };

    void loadDirectory();

    return () => {
      active = false;
    };
  }, [department, semester, batch]);

  const onExportStudentPdf = async (event: FormEvent) => {
    event.preventDefault();
    if (!studentOption?.value) {
      setError("Select a student to export.");
      setMessage("");
      return;
    }

    setLoadingExport(true);
    setError("");
    setMessage("");
    try {
      const student = await getStudent(
        semester,
        department,
        studentOption.value,
        batch,
      );
      const rows = student.subjects.map((subject) => [
        subject.code,
        subject.name,
        subject.grade,
        subject.status,
      ]);

      await exportSingleTablePdf(
        `student-${student.regno}-sem-${semester}.pdf`,
        {
          title: `Student Result - ${student.name}`,
          subtitle: `${department} Semester ${semester} | ${student.regno}`,
          headers: ["Code", "Subject", "Grade", "Status"],
          rows,
        },
        [`SGPA: ${student.sgpa.toFixed(2)}`],
      );

      setMessage("Student PDF export completed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Student export failed.");
    } finally {
      setLoadingExport(false);
    }
  };

  const onExportComparisonPdf = async (event: FormEvent) => {
    event.preventDefault();
    if (comparisonOptions.length < 2) {
      setError("Select at least two students for comparison export.");
      setMessage("");
      return;
    }
    if (comparisonOptions.length > 12) {
      setError("Comparison export supports up to 12 students.");
      setMessage("");
      return;
    }

    setLoadingExport(true);
    setError("");
    setMessage("");
    try {
      const students = await Promise.all(
        comparisonOptions.map((option) =>
          getStudent(semester, department, option.value, batch),
        ),
      );

      const comparison = buildComparisonTable(students);
      const rows = comparison.rows.map((row) => [
        row.subjectCode,
        row.subjectName,
        ...row.points.map((cell) => formatPointWithDiff(cell)),
        row.spread > 0 ? `+${row.spread}` : "",
      ]);

      await exportSingleTablePdf(
        `comparison-sem-${semester}-${department}.pdf`,
        {
          title: "Student Comparison",
          subtitle: `${department} Semester ${semester} | ${students.length} students`,
          headers: comparison.headers,
          rows,
        },
        comparison.footer,
        { highlightDiffs: true },
      );

      setMessage("Comparison PDF export completed.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Comparison export failed.",
      );
    } finally {
      setLoadingExport(false);
    }
  };

  const onExportArrearsPdf = async (event: FormEvent) => {
    event.preventDefault();
    if (selectedArrearTabs.length === 0) {
      setError("Select at least one arrear bucket.");
      setMessage("");
      return;
    }

    setLoadingExport(true);
    setError("");
    setMessage("");
    try {
      const rowsByTab = await Promise.all(
        selectedArrearTabs.map(async (tab) => {
          const payload =
            tab === "1" || tab === "2" || tab === "3+"
              ? await getArrearStudents(semester, department, {
                  bucket: tab,
                  batch,
                })
              : await getArrearStudents(semester, department, {
                  exactCount: Number(tab),
                  batch,
                });

          return [tab, payload.students] as const;
        }),
      );

      const tables = rowsByTab.map(([tab, students]) => ({
        title: `Arrear Explorer - ${tabLabel[tab]}`,
        subtitle: `${department} Semester ${semester}`,
        headers: ["Reg No", "Name", "Arrears"],
        rows: students.map((item) => [
          item.regno,
          item.name,
          String(item.arrears),
        ]),
      }));

      await exportMultiPageTablesPdf(
        `arrears-sem-${semester}-${department}.pdf`,
        tables,
      );

      setMessage("Arrears PDF export completed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Arrears export failed.");
    } finally {
      setLoadingExport(false);
    }
  };

  const onExportRankingsPdf = async (event: FormEvent) => {
    event.preventDefault();

    setLoadingExport(true);
    setError("");
    setMessage("");
    try {
      const rankList = await getRankList(semester, department, topK, batch);
      await exportSingleTablePdf(`rankings-sem-${semester}-${department}.pdf`, {
        title: "Rank List",
        subtitle: `${department} Semester ${semester} | Top ${rankList.length}`,
        headers: ["Rank", "Reg No", "Name", "SGPA"],
        rows: rankList.map((row) => [
          String(row.rank),
          row.regno,
          row.name,
          row.sgpa.toFixed(2),
        ]),
      });

      setMessage("Rankings PDF export completed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rankings export failed.");
    } finally {
      setLoadingExport(false);
    }
  };

  return (
    <section className="grid page-stack">
      <article className="panel">
        <h2>PDF Export Center</h2>
        <p className="hint">
          All PDF exports are handled here for Department {department}, Semester{" "}
          {semester}.
        </p>

        {error ? <p className="inline-error">{error}</p> : null}
        {message ? <p className="success-banner">{message}</p> : null}

        <div className="grid grid-two">
          <form onSubmit={onExportStudentPdf} className="stack result-block">
            <h3>Student Result PDF</h3>
            <div className="input-wrap">
              <label htmlFor="exportStudentSelect">Student</label>
              <Select
                inputId="exportStudentSelect"
                options={studentOptions}
                value={studentOption}
                onChange={(option) => setStudentOption(option)}
                isLoading={loadingDirectory}
                placeholder="Select student..."
                isClearable
                menuPlacement="auto"
                menuPosition="fixed"
                menuPortalTarget={menuPortalTarget}
                classNamePrefix="rs"
              />
            </div>
            <button type="submit" disabled={loadingExport}>
              Export Student PDF
            </button>
          </form>

          <form onSubmit={onExportComparisonPdf} className="stack result-block">
            <h3>Comparison PDF</h3>
            <div className="input-wrap">
              <label htmlFor="exportCompareSelect">Students</label>
              <Select
                inputId="exportCompareSelect"
                options={studentOptions}
                value={comparisonOptions}
                onChange={(options) =>
                  setComparisonOptions(options as Option[])
                }
                isMulti
                isLoading={loadingDirectory}
                placeholder="Select 2 to 12 students..."
                menuPlacement="auto"
                menuPosition="fixed"
                menuPortalTarget={menuPortalTarget}
                classNamePrefix="rs"
              />
            </div>
            <button type="submit" disabled={loadingExport}>
              Export Comparison PDF
            </button>
          </form>

          <form onSubmit={onExportArrearsPdf} className="stack result-block">
            <h3>Arrears PDF</h3>
            <div className="arrear-tab-grid">
              {allTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={
                    selectedArrearTabs.includes(tab)
                      ? "tab-chip active"
                      : "tab-chip"
                  }
                  onClick={() => {
                    setSelectedArrearTabs((current) => {
                      if (current.includes(tab)) {
                        return current.filter((item) => item !== tab);
                      }
                      return [...current, tab];
                    });
                  }}
                >
                  {tabLabel[tab]}
                </button>
              ))}
            </div>
            <button type="submit" disabled={loadingExport}>
              Export Arrears PDF
            </button>
          </form>

          <form onSubmit={onExportRankingsPdf} className="stack result-block">
            <h3>Rankings PDF</h3>
            <div className="input-wrap compact">
              <label htmlFor="exportTopK">Top K</label>
              <input
                id="exportTopK"
                type="number"
                min={1}
                max={200}
                value={topK}
                onChange={(event) => setTopK(Number(event.target.value))}
              />
            </div>
            <button type="submit" disabled={loadingExport}>
              Export Rankings PDF
            </button>
          </form>
        </div>
      </article>
    </section>
  );
}
