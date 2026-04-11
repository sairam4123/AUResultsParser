import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { getDepartmentSummaries, getSummary } from "../api/client";
import { SummaryCards } from "../components/SummaryCards";
import type { LayoutOutletContext } from "../layout/layoutContext";
import type { DepartmentSummary, Summary } from "../types/api";

export function OverviewPage() {
  const { department, semester, batch, departments } =
    useOutletContext<LayoutOutletContext>();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [departmentRows, setDepartmentRows] = useState<DepartmentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!department || !semester || departments.length === 0) {
      return;
    }

    let active = true;

    const loadData = async () => {
      setLoading(true);
      setError("");
      try {
        const [selectedSummary, allDepartmentSummaries] = await Promise.all([
          getSummary(semester, department, batch),
          getDepartmentSummaries(semester, departments, batch),
        ]);

        if (!active) {
          return;
        }

        setSummary(selectedSummary);
        setDepartmentRows(allDepartmentSummaries);
      } catch (err) {
        if (!active) {
          return;
        }

        setSummary(null);
        setDepartmentRows([]);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load overview statistics.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadData().catch(() => {
      if (active) {
        setError("Failed to load overview statistics.");
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [department, semester, batch, departments]);

  const topDepartment = useMemo(() => departmentRows[0], [departmentRows]);

  return (
    <section className="grid page-stack">
      <article className="panel panel-kpi">
        <div className="panel-head panel-head-stack">
          <h2>Semester Snapshot</h2>
          <p className="hint">
            Quick health metrics for the currently selected department,
            semester, and batch.
          </p>
        </div>
        {loading && !summary ? <p>Loading summary...</p> : null}
        {summary ? (
          <SummaryCards summary={summary} />
        ) : (
          <p className="hint">No summary available for this selection.</p>
        )}
      </article>

      <article className="panel">
        <div className="panel-head panel-head-stack">
          <h2>Department Comparison</h2>
          <p className="hint">
            Compare pass metrics across departments for Semester {semester}.
          </p>
        </div>
        {error ? <p className="inline-error">{error}</p> : null}
        {topDepartment ? (
          <p className="callout">
            Top pass rate in Semester {semester}:{" "}
            <strong>{topDepartment.name}</strong> at{" "}
            <strong>{topDepartment.summary.pass_percentage.toFixed(2)}%</strong>
            .
          </p>
        ) : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Department</th>
                <th>Code</th>
                <th>Appeared</th>
                <th>Passed</th>
                <th>Failed</th>
                <th>Pass %</th>
                <th>1 Arrear</th>
                <th>2 Arrears</th>
                <th>3+ Arrears</th>
              </tr>
            </thead>
            <tbody>
              {departmentRows.map((item) => (
                <tr key={item.code}>
                  <td>{item.name}</td>
                  <td>{item.code}</td>
                  <td>{item.summary.appeared}</td>
                  <td>{item.summary.passed}</td>
                  <td>{item.summary.failed}</td>
                  <td>{item.summary.pass_percentage.toFixed(2)}%</td>
                  <td>{item.summary.one_arrear}</td>
                  <td>{item.summary.two_arrears}</td>
                  <td>{item.summary["three+_arrears"]}</td>
                </tr>
              ))}
              {departmentRows.length === 0 ? (
                <tr>
                  <td colSpan={9}>No per-department summary available.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
