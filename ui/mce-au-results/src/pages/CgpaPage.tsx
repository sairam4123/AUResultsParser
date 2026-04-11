import { useState } from "react";
import type { FormEvent } from "react";
import Select, { type SingleValue } from "react-select";
import { useOutletContext } from "react-router-dom";
import { getCgpaBreakdown, getCgpaClass, getCgpaCompare } from "../api/client";
import { StudentNameLink } from "../components/StudentNameLink";
import type { LayoutOutletContext } from "../layout/layoutContext";
import type {
  CgpaBreakdownResponse,
  CgpaClassResponse,
  CgpaCompareResponse,
} from "../types/api";

type SortOption = {
  value: "cgpa" | "arrears" | "regno";
  label: string;
};

type SubjectDetailOption = {
  value: "yes" | "no";
  label: string;
};

const formatMaybe = (value: number | null, suffix = "") => {
  if (value === null) {
    return "-";
  }
  return `${value.toFixed(2)}${suffix}`;
};

export function CgpaPage() {
  const { department, semester, batch } =
    useOutletContext<LayoutOutletContext>();
  const menuPortalTarget =
    typeof window !== "undefined" ? document.body : undefined;
  const [semestersInput, setSemestersInput] = useState("3,4,5");

  const [sortBy, setSortBy] = useState<"cgpa" | "arrears" | "regno">("cgpa");
  const [topInput, setTopInput] = useState("50");
  const [regnoFilter, setRegnoFilter] = useState("");

  const [classData, setClassData] = useState<CgpaClassResponse | null>(null);
  const [classLoading, setClassLoading] = useState(false);
  const [classError, setClassError] = useState("");

  const [breakdownRegno, setBreakdownRegno] = useState("");
  const [breakdownData, setBreakdownData] =
    useState<CgpaBreakdownResponse | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownError, setBreakdownError] = useState("");

  const [compareRegno1, setCompareRegno1] = useState("");
  const [compareRegno2, setCompareRegno2] = useState("");
  const [subjectDetails, setSubjectDetails] = useState(false);
  const [compareData, setCompareData] = useState<CgpaCompareResponse | null>(
    null,
  );
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");

  const sortOptions: SortOption[] = [
    { value: "cgpa", label: "CGPA" },
    { value: "arrears", label: "Arrears" },
    { value: "regno", label: "Reg No" },
  ];

  const selectedSortOption =
    sortOptions.find((option) => option.value === sortBy) ?? sortOptions[0];

  const subjectDetailOptions: SubjectDetailOption[] = [
    { value: "no", label: "Summary only" },
    { value: "yes", label: "Include details" },
  ];

  const selectedSubjectDetailOption = subjectDetails
    ? subjectDetailOptions[1]
    : subjectDetailOptions[0];

  const rankByRegno = new Map<string, number | null>();
  if (classData) {
    const rankedRows = [...classData.rows].sort((left, right) => {
      const leftCgpa = left.cgpa ?? -1;
      const rightCgpa = right.cgpa ?? -1;
      if (rightCgpa !== leftCgpa) {
        return rightCgpa - leftCgpa;
      }
      return left.regno.localeCompare(right.regno);
    });

    let previousCgpa: number | null = null;
    let previousRank = 0;

    rankedRows.forEach((row, index) => {
      if (row.cgpa === null) {
        rankByRegno.set(row.regno, null);
        return;
      }

      if (previousCgpa !== null && row.cgpa === previousCgpa) {
        rankByRegno.set(row.regno, previousRank);
        return;
      }

      const nextRank = index + 1;
      previousCgpa = row.cgpa;
      previousRank = nextRank;
      rankByRegno.set(row.regno, nextRank);
    });
  }

  const onUseCurrentSemester = () => {
    setSemestersInput(String(semester));
  };

  const onLoadClass = async (event: FormEvent) => {
    event.preventDefault();

    setClassLoading(true);
    setClassError("");

    try {
      const numericTop = Number(topInput.trim());
      const payload = await getCgpaClass({
        semesters: semestersInput,
        department,
        batch,
        regno: regnoFilter,
        sortBy,
        top:
          Number.isFinite(numericTop) && numericTop > 0
            ? Math.floor(numericTop)
            : undefined,
      });
      setClassData(payload);
    } catch (err) {
      setClassData(null);
      setClassError(
        err instanceof Error ? err.message : "Failed to load class CGPA table",
      );
    } finally {
      setClassLoading(false);
    }
  };

  const onLoadBreakdown = async (event: FormEvent) => {
    event.preventDefault();

    if (!breakdownRegno.trim()) {
      setBreakdownError("Enter a registration number.");
      return;
    }

    setBreakdownLoading(true);
    setBreakdownError("");

    try {
      const payload = await getCgpaBreakdown({
        semesters: semestersInput,
        department,
        batch,
        regno: breakdownRegno,
      });
      setBreakdownData(payload);
    } catch (err) {
      setBreakdownData(null);
      setBreakdownError(
        err instanceof Error ? err.message : "Failed to load CGPA breakdown",
      );
    } finally {
      setBreakdownLoading(false);
    }
  };

  const onLoadCompare = async (event: FormEvent) => {
    event.preventDefault();

    if (!compareRegno1.trim() || !compareRegno2.trim()) {
      setCompareError("Enter both registration numbers.");
      return;
    }

    setCompareLoading(true);
    setCompareError("");

    try {
      const payload = await getCgpaCompare({
        semesters: semestersInput,
        department,
        batch,
        regno1: compareRegno1,
        regno2: compareRegno2,
        subjectDetails,
      });
      setCompareData(payload);
    } catch (err) {
      setCompareData(null);
      setCompareError(
        err instanceof Error ? err.message : "Failed to compare CGPA breakdown",
      );
    } finally {
      setCompareLoading(false);
    }
  };

  return (
    <section className="grid page-stack">
      <article className="panel">
        <div className="panel-head panel-head-stack">
          <h2>CGPA Across Semesters</h2>
          <p className="hint">
            Define the semester set once, then use it for class view, student
            breakdown, and comparison.
          </p>
        </div>
        <div className="grid-two">
          <div className="input-wrap">
            <label htmlFor="cgpaSemesters">Semesters</label>
            <div className="inline-form">
              <input
                id="cgpaSemesters"
                value={semestersInput}
                onChange={(event) => setSemestersInput(event.target.value)}
                placeholder="3,4,5"
              />
              <button
                type="button"
                className="button-secondary"
                onClick={onUseCurrentSemester}
              >
                Use Current Semester ({semester})
              </button>
            </div>
            <p className="hint">Enter comma-separated values like 3,4,5.</p>
            <p className="hint">
              Batch filter from top bar: {batch.trim() || "Latest available"}.
            </p>
          </div>
        </div>
      </article>

      <article className="panel">
        <div className="panel-head panel-head-stack">
          <h2>Class CGPA Table</h2>
          <p className="hint">
            Load a class-wide table and optionally narrow by RegNo prefix.
          </p>
        </div>

        <form onSubmit={onLoadClass} className="inline-form">
          <div className="input-wrap compact">
            <label htmlFor="cgpaSort">Sort</label>
            <Select<SortOption>
              inputId="cgpaSort"
              options={sortOptions}
              value={selectedSortOption}
              onChange={(option: SingleValue<SortOption>) => {
                if (option) {
                  setSortBy(option.value);
                }
              }}
              isSearchable={false}
              menuPlacement="auto"
              menuPosition="fixed"
              menuPortalTarget={menuPortalTarget}
              className="rs-single"
              classNamePrefix="rs"
            />
          </div>

          <div className="input-wrap compact">
            <label htmlFor="cgpaTop">Record Limit</label>
            <input
              id="cgpaTop"
              type="number"
              min={1}
              value={topInput}
              onChange={(event) => setTopInput(event.target.value)}
            />
          </div>

          <div className="input-wrap">
            <label htmlFor="cgpaRegnoFilter">RegNo Filter (Optional)</label>
            <input
              id="cgpaRegnoFilter"
              value={regnoFilter}
              onChange={(event) => setRegnoFilter(event.target.value)}
              placeholder="812823205060"
            />
          </div>

          <button type="submit" disabled={classLoading}>
            {classLoading ? "Loading..." : "Load Class CGPA Table"}
          </button>
        </form>

        {classError ? <p className="inline-error">{classError}</p> : null}

        {classData ? (
          <div className="result-block">
            <p>
              Students: <strong>{classData.summary.students_considered}</strong>{" "}
              | Avg CGPA:{" "}
              <strong>{classData.summary.average_cgpa.toFixed(2)}</strong> |
              Total Arrears: <strong>{classData.summary.total_arrears}</strong>{" "}
              | No Arrears:{" "}
              <strong>{classData.summary.students_without_arrears}</strong>
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Reg No</th>
                    <th>Name</th>
                    <th>Rank</th>
                    {classData.semesters.map((value) => (
                      <th key={`sem-${value}`}>S{value} SGPA</th>
                    ))}
                    <th>CGPA</th>
                    <th>Arrears</th>
                    <th>Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {classData.rows.map((row) => (
                    <tr key={row.regno}>
                      <td>{row.regno}</td>
                      <td>
                        <StudentNameLink regno={row.regno} name={row.name} />
                      </td>
                      <td>{rankByRegno.get(row.regno) ?? "N/A"}</td>
                      {classData.semesters.map((value) => {
                        const key = String(value);
                        return (
                          <td key={`${row.regno}-${key}`}>
                            {formatMaybe(row.semester_sgpa[key] ?? null)}
                          </td>
                        );
                      })}
                      <td>{formatMaybe(row.cgpa)}</td>
                      <td>{row.arrears}</td>
                      <td>{row.credits.toFixed(1)}</td>
                    </tr>
                  ))}
                  {classData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={7 + classData.semesters.length}>
                        No students found for this filter.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </article>

      <article className="panel">
        <div className="panel-head panel-head-stack">
          <h2>Single Student CGPA Breakdown</h2>
          <p className="hint">
            Enter a registration number to inspect semester-wise CGPA math.
          </p>
        </div>

        <form onSubmit={onLoadBreakdown} className="inline-form">
          <div className="input-wrap">
            <label htmlFor="cgpaBreakdownRegno">Registration Number</label>
            <input
              id="cgpaBreakdownRegno"
              value={breakdownRegno}
              onChange={(event) => setBreakdownRegno(event.target.value)}
              placeholder="812823205060"
            />
          </div>
          <button type="submit" disabled={breakdownLoading}>
            {breakdownLoading ? "Loading..." : "Load Student Breakdown"}
          </button>
        </form>

        {breakdownError ? (
          <p className="inline-error">{breakdownError}</p>
        ) : null}

        {breakdownData ? (
          <div className="result-block">
            <p>
              <strong>
                <StudentNameLink
                  regno={breakdownData.regno}
                  name={breakdownData.name}
                />
              </strong>{" "}
              ({breakdownData.regno})
            </p>
            {breakdownData.semesters.map((semesterData) => (
              <div
                key={`bd-sem-${semesterData.semester}`}
                className="result-block"
              >
                <h3>Semester {semesterData.semester}</h3>
                <p>
                  SGPA = {semesterData.totals.grade_points.toFixed(2)} /{" "}
                  {semesterData.totals.credits.toFixed(1)} ={" "}
                  <strong>{formatMaybe(semesterData.totals.sgpa)}</strong> |
                  Arrears: <strong>{semesterData.totals.arrears}</strong>
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
              </div>
            ))}

            <p>
              Overall CGPA = {breakdownData.overall.grade_points.toFixed(2)} /{" "}
              {breakdownData.overall.credits.toFixed(1)} ={" "}
              <strong>{formatMaybe(breakdownData.overall.cgpa)}</strong> | Total
              Arrears: <strong>{breakdownData.overall.arrears}</strong>
            </p>
          </div>
        ) : null}
      </article>

      <article className="panel">
        <div className="panel-head panel-head-stack">
          <h2>Compare Two Students (CGPA Breakdown)</h2>
          <p className="hint">
            Compare two students on CGPA, arrears, credits, and subject-level
            impact.
          </p>
        </div>

        <form onSubmit={onLoadCompare} className="inline-form">
          <div className="input-wrap">
            <label htmlFor="cgpaRegno1">RegNo 1</label>
            <input
              id="cgpaRegno1"
              value={compareRegno1}
              onChange={(event) => setCompareRegno1(event.target.value)}
              placeholder="812823205060"
            />
          </div>

          <div className="input-wrap">
            <label htmlFor="cgpaRegno2">RegNo 2</label>
            <input
              id="cgpaRegno2"
              value={compareRegno2}
              onChange={(event) => setCompareRegno2(event.target.value)}
              placeholder="812823205023"
            />
          </div>

          <div className="input-wrap compact">
            <label htmlFor="cgpaSubjectDetails">Subject Detail</label>
            <Select<SubjectDetailOption>
              inputId="cgpaSubjectDetails"
              options={subjectDetailOptions}
              value={selectedSubjectDetailOption}
              onChange={(option: SingleValue<SubjectDetailOption>) => {
                setSubjectDetails(option?.value === "yes");
              }}
              isSearchable={false}
              menuPlacement="auto"
              menuPosition="fixed"
              menuPortalTarget={menuPortalTarget}
              className="rs-single"
              classNamePrefix="rs"
            />
          </div>

          <button type="submit" disabled={compareLoading}>
            {compareLoading ? "Loading..." : "Compare CGPA Profiles"}
          </button>
        </form>

        {compareError ? <p className="inline-error">{compareError}</p> : null}

        {compareData ? (
          <div className="result-block">
            <p>
              <strong>
                <StudentNameLink
                  regno={compareData.student1.regno}
                  name={compareData.student1.name}
                />
              </strong>{" "}
              ({compareData.student1.regno}) vs{" "}
              <strong>
                <StudentNameLink
                  regno={compareData.student2.regno}
                  name={compareData.student2.name}
                />
              </strong>{" "}
              ({compareData.student2.regno})
            </p>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>{compareData.student1.regno.slice(-3)} Value</th>
                    <th>{compareData.student2.regno.slice(-3)} Value</th>
                    <th>Diff</th>
                    <th>{compareData.student1.regno.slice(-3)} Arrears</th>
                    <th>{compareData.student2.regno.slice(-3)} Arrears</th>
                    <th>{compareData.student1.regno.slice(-3)} Credits</th>
                    <th>{compareData.student2.regno.slice(-3)} Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {compareData.rows.map((row) => (
                    <tr key={row.metric}>
                      <td>{row.metric}</td>
                      <td>{formatMaybe(row.student1_value)}</td>
                      <td>{formatMaybe(row.student2_value)}</td>
                      <td>{formatMaybe(row.diff)}</td>
                      <td>{row.student1_arrears}</td>
                      <td>{row.student2_arrears}</td>
                      <td>{row.student1_credits.toFixed(1)}</td>
                      <td>{row.student2_credits.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {compareData.subject_details.map((detail) => (
              <div
                key={`detail-sem-${detail.semester}`}
                className="result-block"
              >
                <h3>Semester {detail.semester} Subject Detail</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Subject</th>
                        <th>Credit</th>
                        <th>{compareData.student1.regno.slice(-3)} Grade</th>
                        <th>
                          {compareData.student1.regno.slice(-3)} Credit x GP
                        </th>
                        <th>{compareData.student2.regno.slice(-3)} Grade</th>
                        <th>
                          {compareData.student2.regno.slice(-3)} Credit x GP
                        </th>
                        <th>Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.rows.map((row) => (
                        <tr key={`${detail.semester}-${row.code}`}>
                          <td>{row.code}</td>
                          <td>{row.name}</td>
                          <td>{row.credit.toFixed(1)}</td>
                          <td>{row.student1_grade}</td>
                          <td>{row.student1_credit_x_gp.toFixed(2)}</td>
                          <td>{row.student2_grade}</td>
                          <td>{row.student2_credit_x_gp.toFixed(2)}</td>
                          <td>{row.diff.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </article>
    </section>
  );
}
