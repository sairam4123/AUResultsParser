import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Select from "react-select";
import { useOutletContext } from "react-router-dom";
import { getStudent, getStudentsDirectory } from "../api/client";
import { StudentNameLink } from "../components/StudentNameLink";
import type { LayoutOutletContext } from "../layout/layoutContext";
import type { Student, StudentDirectoryItem } from "../types/api";
import { exportSingleTablePdf } from "../utils/pdf";

type Option = {
  value: string;
  label: string;
  name: string;
};

const toOption = (item: StudentDirectoryItem): Option => ({
  value: item.regno,
  label: `${item.name} (${item.regno})`,
  name: item.name,
});

export function StudentsPage() {
  const { department, semester, batch } =
    useOutletContext<LayoutOutletContext>();
  const menuPortalTarget =
    typeof window !== "undefined" ? document.body : undefined;

  const [student, setStudent] = useState<Student | null>(null);

  const [studentOptions, setStudentOptions] = useState<Option[]>([]);
  const [lookupOption, setLookupOption] = useState<Option | null>(null);

  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

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
        const options = items.map(toOption);
        setStudentOptions(options);
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
  }, [department, semester, batch]);

  const onSearchStudent = async (event: FormEvent) => {
    event.preventDefault();
    if (!lookupOption?.value) {
      setError("Select a student by name or registration number.");
      return;
    }

    setLoadingStudent(true);
    setError("");
    try {
      const payload = await getStudent(
        semester,
        department,
        lookupOption.value,
        batch,
      );
      setStudent(payload);
    } catch (err) {
      setStudent(null);
      setError(err instanceof Error ? err.message : "Failed to load student");
    } finally {
      setLoadingStudent(false);
    }
  };

  const onExportStudentPdf = async () => {
    if (!student) {
      return;
    }

    setExporting(true);
    setError("");
    try {
      await exportSingleTablePdf(
        `student-${student.regno}-sem-${semester}.pdf`,
        {
          title: `Student Result - ${student.name}`,
          subtitle: `${department} Semester ${semester} | ${student.regno}`,
          headers: ["Code", "Subject", "Grade", "Status"],
          rows: student.subjects.map((subject) => [
            subject.code,
            subject.name,
            subject.grade,
            subject.status,
          ]),
        },
        [`SGPA: ${student.sgpa.toFixed(2)}`],
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Student PDF export failed.",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="grid page-stack">
      <article className="panel">
        <div className="panel-head panel-head-stack">
          <h2>Student Lookup</h2>
          <p className="hint">
            Select a student from the list and load a detailed semester result
            view.
          </p>
        </div>

        <form onSubmit={onSearchStudent} className="stack">
          <div className="input-wrap">
            <label htmlFor="studentSelect">Search by Name / Reg No</label>
            <Select
              inputId="studentSelect"
              options={studentOptions}
              value={lookupOption}
              onChange={(option) => setLookupOption(option)}
              isLoading={loadingDirectory}
              placeholder="Start typing name or registration number..."
              isClearable
              menuPlacement="auto"
              menuPosition="fixed"
              menuPortalTarget={menuPortalTarget}
              classNamePrefix="rs"
            />
          </div>
          <button type="submit" disabled={loadingStudent}>
            {loadingStudent ? "Fetching..." : "Load Student Profile"}
          </button>
        </form>

        {error ? <p className="inline-error">{error}</p> : null}

        {student ? (
          <div className="result-block">
            <div className="summary-strip summary-strip-compact">
              <div className="metric-card">
                <span>Student</span>
                <strong>
                  <StudentNameLink regno={student.regno} name={student.name} />
                </strong>
                <span>{student.regno}</span>
              </div>
              <div className="metric-card metric-pass">
                <span>SGPA</span>
                <strong>{student.sgpa.toFixed(2)}</strong>
              </div>
              <div className="metric-card">
                <span>Rank</span>
                <strong>{student.rank ?? "N/A"}</strong>
              </div>
              <div className="metric-card">
                <span>Arrears</span>
                <strong>{student.arrears}</strong>
              </div>
            </div>

            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                void onExportStudentPdf();
              }}
              disabled={exporting}
            >
              {exporting ? "Exporting..." : "Export Student PDF"}
            </button>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Subject</th>
                    <th>Grade</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {student.subjects.map((subject) => (
                    <tr key={subject.code}>
                      <td>{subject.code}</td>
                      <td>{subject.name}</td>
                      <td>{subject.grade}</td>
                      <td>{subject.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </article>
    </section>
  );
}
