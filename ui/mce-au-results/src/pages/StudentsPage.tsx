import { useState } from "react";
import type { FormEvent } from "react";
import { useOutletContext } from "react-router-dom";
import { compareStudents, getStudent } from "../api/client";
import type { LayoutOutletContext } from "../layout/layoutContext";
import type { Comparison, Student } from "../types/api";

export function StudentsPage() {
  const { department, semester } = useOutletContext<LayoutOutletContext>();

  const [student, setStudent] = useState<Student | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);

  const [studentRegNo, setStudentRegNo] = useState("");
  const [compareRegNo1, setCompareRegNo1] = useState("");
  const [compareRegNo2, setCompareRegNo2] = useState("");

  const [loadingStudent, setLoadingStudent] = useState(false);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [error, setError] = useState("");

  const onSearchStudent = async (event: FormEvent) => {
    event.preventDefault();
    if (!studentRegNo.trim()) {
      setError("Enter a registration number to search student details.");
      return;
    }

    setLoadingStudent(true);
    setError("");
    try {
      const payload = await getStudent(semester, department, studentRegNo);
      setStudent(payload);
    } catch (err) {
      setStudent(null);
      setError(err instanceof Error ? err.message : "Failed to load student");
    } finally {
      setLoadingStudent(false);
    }
  };

  const onCompareStudents = async (event: FormEvent) => {
    event.preventDefault();
    if (!compareRegNo1.trim() || !compareRegNo2.trim()) {
      setError("Enter both registration numbers for comparison.");
      return;
    }

    setLoadingCompare(true);
    setError("");
    try {
      const payload = await compareStudents(
        semester,
        department,
        compareRegNo1,
        compareRegNo2,
      );
      setComparison(payload);
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
    <section className="grid grid-two">
      <article className="panel">
        <h2>Student Lookup</h2>
        <form onSubmit={onSearchStudent} className="stack">
          <div className="input-wrap">
            <label htmlFor="studentRegNo">Registration Number</label>
            <input
              id="studentRegNo"
              value={studentRegNo}
              onChange={(event) => setStudentRegNo(event.target.value)}
              placeholder="812823205001"
            />
          </div>
          <button type="submit" disabled={loadingStudent}>
            {loadingStudent ? "Fetching..." : "Fetch Student Result"}
          </button>
        </form>

        {error ? <p className="inline-error">{error}</p> : null}

        {student ? (
          <div className="result-block">
            <p>
              <strong>{student.name}</strong> ({student.regno})
            </p>
            <p>SGPA: {student.sgpa.toFixed(2)}</p>
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

      <article className="panel">
        <h2>Compare Students</h2>
        <form onSubmit={onCompareStudents} className="stack">
          <div className="input-wrap">
            <label htmlFor="compare1">First Reg No</label>
            <input
              id="compare1"
              value={compareRegNo1}
              onChange={(event) => setCompareRegNo1(event.target.value)}
              placeholder="812823205001"
            />
          </div>
          <div className="input-wrap">
            <label htmlFor="compare2">Second Reg No</label>
            <input
              id="compare2"
              value={compareRegNo2}
              onChange={(event) => setCompareRegNo2(event.target.value)}
              placeholder="812823205002"
            />
          </div>
          <button type="submit" disabled={loadingCompare}>
            {loadingCompare ? "Comparing..." : "Compare"}
          </button>
        </form>

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
                  {comparison.table.map((row, index) => (
                    <tr key={`cmp-row-${index}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`cmp-cell-${index}-${cellIndex}`}>{cell}</td>
                      ))}
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
