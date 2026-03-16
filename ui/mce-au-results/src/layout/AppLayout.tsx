import { NavLink, Outlet } from "react-router-dom";
import type { DepartmentOption } from "../types/api";

type AppLayoutProps = {
  departments: DepartmentOption[];
  semesters: number[];
  department: string;
  semester: number;
  onDepartmentChange: (value: string) => void;
  onSemesterChange: (value: number) => void;
  error: string;
  metaLoading: boolean;
};

export function AppLayout({
  departments,
  semesters,
  department,
  semester,
  onDepartmentChange,
  onSemesterChange,
  error,
  metaLoading,
}: AppLayoutProps) {
  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">AU Results Platform</p>
        <h1>Result Analytics Dashboard</h1>
        <p className="subtitle">
          Explore performance by semester, compare student outcomes, and
          generate rank lists in a responsive multi-page interface.
        </p>
      </header>

      <nav className="panel page-nav" aria-label="Sections">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? "nav-pill active" : "nav-pill"
          }
        >
          Overview
        </NavLink>
        <NavLink
          to="/students"
          className={({ isActive }) =>
            isActive ? "nav-pill active" : "nav-pill"
          }
        >
          Students
        </NavLink>
        <NavLink
          to="/rankings"
          className={({ isActive }) =>
            isActive ? "nav-pill active" : "nav-pill"
          }
        >
          Rankings
        </NavLink>
      </nav>

      <section className="panel filters">
        <div className="input-wrap">
          <label htmlFor="department">Department</label>
          <select
            id="department"
            value={department}
            onChange={(event) => onDepartmentChange(event.target.value)}
            disabled={metaLoading || departments.length === 0}
          >
            {departments.map((dep) => (
              <option key={dep.code} value={dep.name}>
                {dep.name} ({dep.code})
              </option>
            ))}
          </select>
        </div>
        <div className="input-wrap">
          <label htmlFor="semester">Semester</label>
          <select
            id="semester"
            value={semester}
            onChange={(event) => onSemesterChange(Number(event.target.value))}
            disabled={metaLoading || semesters.length === 0}
          >
            {semesters.map((sem) => (
              <option key={sem} value={sem}>
                Semester {sem}
              </option>
            ))}
          </select>
        </div>
        <div className="selection-pill">
          Selected: {department} - Semester {semester}
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      <Outlet context={{ department, semester, departments }} />
    </main>
  );
}
