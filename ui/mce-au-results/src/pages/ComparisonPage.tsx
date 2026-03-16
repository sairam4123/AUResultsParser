import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Select from "react-select";
import { useOutletContext } from "react-router-dom";
import { getStudent, getStudentsDirectory } from "../api/client";
import type { LayoutOutletContext } from "../layout/layoutContext";
import type { Student, StudentDirectoryItem } from "../types/api";

type Option = {
  value: string;
  label: string;
};

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

export function ComparisonPage() {
  const { department, semester } = useOutletContext<LayoutOutletContext>();
  const menuPortalTarget =
    typeof window !== "undefined" ? document.body : undefined;

  const [studentOptions, setStudentOptions] = useState<Option[]>([]);
  const [compareOptions, setCompareOptions] = useState<Option[]>([]);
  const [comparison, setComparison] = useState<ComparisonTable | null>(null);

  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!department || !semester) {
      return;
    }

    let active = true;

    const loadDirectory = async () => {
      setLoadingDirectory(true);
      try {
        const items = await getStudentsDirectory(semester, department);
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

    loadDirectory().catch(() => undefined);

    return () => {
      active = false;
    };
  }, [department, semester]);

  const onCompareStudents = async (event: FormEvent) => {
    event.preventDefault();

    if (compareOptions.length < 2) {
      setError("Select at least two students for comparison.");
      return;
    }

    if (compareOptions.length > 12) {
      setError("Comparison supports up to 12 students at once.");
      return;
    }

    setLoadingCompare(true);
    setError("");

    try {
      const students = await Promise.all(
        compareOptions.map((option) =>
          getStudent(semester, department, option.value),
        ),
      );
      setComparison(buildComparisonTable(students));
    } catch (err) {
      setComparison(null);
      setError(
        err instanceof Error ? err.message : "Failed to compare students",
      );
    } finally {
      setLoadingCompare(false);
    }
  };

  return (
    <section className="grid page-stack">
      <article className="panel">
        <div className="panel-head">
          <h2>Compare Students</h2>
        </div>

        <form onSubmit={onCompareStudents} className="stack">
          <div className="input-wrap">
            <label htmlFor="compareSelect">Select Students</label>
            <Select
              inputId="compareSelect"
              options={studentOptions}
              value={compareOptions}
              onChange={(options) => setCompareOptions(options as Option[])}
              isMulti
              isLoading={loadingDirectory}
              placeholder="Type to search and select multiple students..."
              menuPlacement="auto"
              menuPosition="fixed"
              menuPortalTarget={menuPortalTarget}
              classNamePrefix="rs"
            />
            <p className="hint">Select 2 to 12 students for comparison.</p>
          </div>
          <button type="submit" disabled={loadingCompare}>
            {loadingCompare ? "Comparing..." : "Compare"}
          </button>
        </form>

        {error ? <p className="inline-error">{error}</p> : null}

        {comparison ? (
          <div className="result-block">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {comparison.headers.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.rows.map((row) => (
                    <tr key={row.subjectCode}>
                      <td>{row.subjectCode}</td>
                      <td>{row.subjectName || "-"}</td>
                      {row.points.map((cell, index) => (
                        <td
                          key={`${row.subjectCode}-p-${index}`}
                          className={
                            cell.diff > 0
                              ? "cmp-diff-positive"
                              : "cmp-diff-base"
                          }
                        >
                          <span>{cell.value}</span>
                          {cell.diff > 0 ? (
                            <span className="cmp-diff-tag">(+{cell.diff})</span>
                          ) : null}
                        </td>
                      ))}
                      <td
                        className={
                          row.spread > 0
                            ? "cmp-spread-positive"
                            : "cmp-spread-none"
                        }
                      >
                        {row.spread > 0 ? `+${row.spread}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {comparison.footer.length > 0 ? (
              <div className="footer-notes">
                {comparison.footer.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </article>
    </section>
  );
}
