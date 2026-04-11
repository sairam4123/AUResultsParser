import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { getCgpaBreakdown, getStudent } from "../api/client";
import type { LayoutOutletContext } from "../layout/layoutContext";
import type { CgpaBreakdownResponse, Student } from "../types/api";
import { StudentNameLink } from "../components/StudentNameLink";

type SemesterStudentResult = {
  semester: number;
  student: Student | null;
};

const formatMaybe = (value: number | null, suffix = "") => {
  if (value === null) {
    return "-";
  }
  return `${value.toFixed(2)}${suffix}`;
};

const inferBatchFromRegno = (regno: string): string | null => {
  const digits = regno.replace(/\D/g, "");
  if (digits.length < 6 || !digits.startsWith("8128")) {
    return null;
  }

  return `20${digits.slice(4, 6)}`;
};

export function StudentProfilePage() {
  const { regno = "" } = useParams();
  const { department, batch, availableSemesters } =
    useOutletContext<LayoutOutletContext>();
  const inferredBatch = useMemo(() => inferBatchFromRegno(regno), [regno]);
  const profileBatch = inferredBatch ?? batch;

  const [semesterResults, setSemesterResults] = useState<
    SemesterStudentResult[]
  >([]);
  const [cgpaBreakdown, setCgpaBreakdown] =
    useState<CgpaBreakdownResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasAnySemesterResult = useMemo(
    () => semesterResults.some((item) => item.student !== null),
    [semesterResults],
  );

  useEffect(() => {
    if (!regno.trim() || !department || availableSemesters.length === 0) {
      return;
    }

    let active = true;

    const loadProfile = async () => {
      setLoading(true);
      setError("");
      setSemesterResults([]);
      setCgpaBreakdown(null);

      try {
        const perSemester = await Promise.all(
          availableSemesters.map(async (value) => {
            try {
              const student = await getStudent(
                value,
                department,
                regno,
                profileBatch,
              );
              return {
                semester: value,
                student,
              };
            } catch {
              return {
                semester: value,
                student: null,
              };
            }
          }),
        );

        const allSemesterEntries = perSemester.sort(
          (left, right) => left.semester - right.semester,
        );

        const existingResults = allSemesterEntries.filter(
          (item): item is { semester: number; student: Student } =>
            item.student !== null,
        );

        if (!active) {
          return;
        }

        setSemesterResults(allSemesterEntries);

        if (existingResults.length === 0) {
          setError(
            "No semester records found for this student in current department/batch context.",
          );
          return;
        }

        const semesterCsv = existingResults
          .map((item) => item.semester)
          .join(",");

        try {
          const breakdown = await getCgpaBreakdown({
            semesters: semesterCsv,
            department,
            regno,
            batch: profileBatch,
          });

          if (active) {
            setCgpaBreakdown(breakdown);
          }
        } catch {
          if (active) {
            setCgpaBreakdown(null);
          }
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load student profile.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, [availableSemesters, department, regno, profileBatch]);

  const rankBySemester = useMemo(() => {
    const rankMap = new Map<number, number | null>();
    semesterResults.forEach((item) => {
      rankMap.set(item.semester, item.student?.rank ?? null);
    });
    return rankMap;
  }, [semesterResults]);

  const firstAvailableStudent = semesterResults.find(
    (item): item is { semester: number; student: Student } =>
      item.student !== null,
  );

  const titleName = firstAvailableStudent?.student.name ?? "Student Profile";

  return (
    <section className="grid page-stack">
      <article className="panel">
        <div className="panel-head panel-head-stack">
          <h2>Student Profile</h2>
          <p className="hint">
            Semester-wise results, ranks, and CGPA breakdown for the selected
            student.
          </p>
        </div>

        <p className="selection-pill">
          <span className="selection-chip">
            Student: <strong>{titleName}</strong>
          </span>
          <span className="selection-chip">
            RegNo: <strong>{regno}</strong>
          </span>
          <span className="selection-chip">
            Department: <strong>{department}</strong>
          </span>
          <span className="selection-chip">
            Batch: <strong>{profileBatch || "Latest available"}</strong>
          </span>
        </p>

        {inferredBatch ? (
          <p className="hint">Batch inferred from RegNo: {inferredBatch}</p>
        ) : null}

        <p className="hint">
          <Link to="/students" className="student-name-link">
            Back to student search
          </Link>
        </p>

        {loading ? <p>Loading profile...</p> : null}
        {error ? <p className="inline-error">{error}</p> : null}

        {cgpaBreakdown ? (
          <div className="result-block">
            <div className="summary-strip summary-strip-compact">
              <div className="metric-card metric-pass">
                <span>Overall CGPA</span>
                <strong>{formatMaybe(cgpaBreakdown.overall.cgpa)}</strong>
              </div>
              <div className="metric-card">
                <span>Total Credits</span>
                <strong>{cgpaBreakdown.overall.credits.toFixed(1)}</strong>
              </div>
              <div className="metric-card">
                <span>Grade Points</span>
                <strong>{cgpaBreakdown.overall.grade_points.toFixed(2)}</strong>
              </div>
              <div className="metric-card">
                <span>Total Arrears</span>
                <strong>{cgpaBreakdown.overall.arrears}</strong>
              </div>
            </div>

            {cgpaBreakdown.semesters.map((semesterData) => (
              <section
                key={`profile-sem-${semesterData.semester}`}
                className="result-block"
              >
                <h3>
                  Semester {semesterData.semester} · SGPA{" "}
                  {formatMaybe(semesterData.totals.sgpa)} · Rank{" "}
                  {rankBySemester.get(semesterData.semester) ?? "N/A"}
                </h3>
                <p className="hint">
                  SGPA = {semesterData.totals.grade_points.toFixed(2)} /{" "}
                  {semesterData.totals.credits.toFixed(1)}
                </p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Subject</th>
                        <th>Grade</th>
                        <th>Credit</th>
                        <th>GP</th>
                        <th>Credit x GP</th>
                        <th>Included</th>
                      </tr>
                    </thead>
                    <tbody>
                      {semesterData.subjects.map((subject) => (
                        <tr key={`${semesterData.semester}-${subject.code}`}>
                          <td>{subject.code}</td>
                          <td>{subject.name}</td>
                          <td>{subject.grade}</td>
                          <td>{subject.credit.toFixed(1)}</td>
                          <td>{subject.gp ?? "-"}</td>
                          <td>{subject.credit_x_gp.toFixed(2)}</td>
                          <td>{subject.included ? "Yes" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        ) : (
          !loading &&
          hasAnySemesterResult && (
            <div className="result-block">
              <p className="hint">
                Detailed CGPA breakdown is unavailable for the current semester
                files, but semester-level snapshots are shown below. Missing
                semesters are marked as unavailable.
              </p>
              {semesterResults.map((entry) => (
                <section
                  key={`fallback-sem-${entry.semester}`}
                  className="result-block"
                >
                  {entry.student ? (
                    <>
                      <h3>
                        Semester {entry.semester} · SGPA{" "}
                        {entry.student.sgpa.toFixed(2)} · Rank{" "}
                        {entry.student.rank ?? "N/A"}
                      </h3>
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
                            {entry.student.subjects.map((subject) => (
                              <tr key={`${entry.semester}-${subject.code}`}>
                                <td>{subject.code}</td>
                                <td>{subject.name}</td>
                                <td>{subject.grade}</td>
                                <td>{subject.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3>Semester {entry.semester}</h3>
                      <p className="hint">
                        No result file entry was found for this student in this
                        semester.
                      </p>
                    </>
                  )}
                </section>
              ))}
            </div>
          )
        )}
      </article>

      {!loading && semesterResults.length > 0 ? (
        <article className="panel">
          <h2>Quick Semester Snapshot</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Semester</th>
                  <th>Student</th>
                  <th>SGPA</th>
                  <th>Rank</th>
                  <th>Arrears</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {semesterResults.map((entry) => (
                  <tr key={`summary-${entry.semester}`}>
                    <td>{entry.semester}</td>
                    <td>
                      {entry.student ? (
                        <StudentNameLink
                          regno={entry.student.regno}
                          name={entry.student.name}
                        />
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      {entry.student ? entry.student.sgpa.toFixed(2) : "-"}
                    </td>
                    <td>{entry.student?.rank ?? "-"}</td>
                    <td>{entry.student?.arrears ?? "-"}</td>
                    <td>{entry.student ? "Available" : "Not available"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}
    </section>
  );
}
