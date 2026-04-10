import Select, { type SingleValue } from "react-select";
import { NavLink, Outlet } from "react-router-dom";
import type { DepartmentOption } from "../types/api";

type DepartmentSelectOption = {
  value: string;
  label: string;
};

type SemesterSelectOption = {
  value: number;
  label: string;
};

type AppLayoutProps = {
  departments: DepartmentOption[];
  semesters: number[];
  department: string;
  semester: number;
  batch: string;
  onDepartmentChange: (value: string) => void;
  onSemesterChange: (value: number) => void;
  onBatchChange: (value: string) => void;
  error: string;
  metaLoading: boolean;
};

export function AppLayout({
  departments,
  semesters,
  department,
  semester,
  batch,
  onDepartmentChange,
  onSemesterChange,
  onBatchChange,
  error,
  metaLoading,
}: AppLayoutProps) {
  const menuPortalTarget =
    typeof window !== "undefined" ? document.body : undefined;

  const departmentOptions: DepartmentSelectOption[] = departments.map(
    (dep) => ({
      value: dep.name,
      label: `${dep.name} (${dep.code})`,
    }),
  );

  const selectedDepartmentOption =
    departmentOptions.find((option) => option.value === department) ?? null;

  const semesterOptions: SemesterSelectOption[] = semesters.map((sem) => ({
    value: sem,
    label: `Semester ${sem}`,
  }));

  const selectedSemesterOption =
    semesterOptions.find((option) => option.value === semester) ?? null;

  return (
    <main className="page">
      <header className="hero">
        <div className="hero-brand-row" aria-label="Institution branding">
          <img
            src="/mce-logo-2-og.png"
            alt="Mookambigai College of Engineering"
            className="brand-logo brand-logo-mce"
          />
          <div className="hero-title-block">
            <p className="brand-name">MOOKAMBIGAI COLLEGE OF ENGINEERING</p>
            <p className="eyebrow">AU RESULTS PLATFORM</p>
          </div>
          <img
            src="/iqac-logo-og.png"
            alt="IQAC"
            className="brand-logo brand-logo-iqac"
          />
        </div>
        <h1>Result Analytics Dashboard</h1>
        <p className="subtitle">
          Explore student performance, arrears, rankings, and trend insights in
          one place.
        </p>
      </header>

      <section className="top-grid">
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
            to="/cgpa"
            className={({ isActive }) =>
              isActive ? "nav-pill active" : "nav-pill"
            }
          >
            CGPA
          </NavLink>
          <NavLink
            to="/comparison"
            className={({ isActive }) =>
              isActive ? "nav-pill active" : "nav-pill"
            }
          >
            Comparison
          </NavLink>
          <NavLink
            to="/arrears"
            className={({ isActive }) =>
              isActive ? "nav-pill active" : "nav-pill"
            }
          >
            Arrears
          </NavLink>
          <NavLink
            to="/rankings"
            className={({ isActive }) =>
              isActive ? "nav-pill active" : "nav-pill"
            }
          >
            Rankings
          </NavLink>
          <NavLink
            to="/exports"
            className={({ isActive }) =>
              isActive ? "nav-pill active" : "nav-pill"
            }
          >
            Exports
          </NavLink>
          <NavLink
            to="/imports"
            className={({ isActive }) =>
              isActive ? "nav-pill active" : "nav-pill"
            }
          >
            Imports
          </NavLink>
        </nav>

        <section className="panel filters">
          <div className="input-wrap">
            <label htmlFor="departmentSelect">Department</label>
            <Select<DepartmentSelectOption>
              inputId="departmentSelect"
              options={departmentOptions}
              value={selectedDepartmentOption}
              onChange={(option: SingleValue<DepartmentSelectOption>) => {
                if (option) {
                  onDepartmentChange(option.value);
                }
              }}
              isDisabled={metaLoading || departments.length === 0}
              isSearchable
              menuPlacement="auto"
              menuPosition="fixed"
              menuPortalTarget={menuPortalTarget}
              className="rs-single"
              classNamePrefix="rs"
            />
          </div>
          <div className="input-wrap">
            <label htmlFor="semesterSelect">Semester</label>
            <Select<SemesterSelectOption>
              inputId="semesterSelect"
              options={semesterOptions}
              value={selectedSemesterOption}
              onChange={(option: SingleValue<SemesterSelectOption>) => {
                if (option) {
                  onSemesterChange(option.value);
                }
              }}
              isDisabled={metaLoading || semesters.length === 0}
              isSearchable={false}
              menuPlacement="auto"
              menuPosition="fixed"
              menuPortalTarget={menuPortalTarget}
              className="rs-single"
              classNamePrefix="rs"
            />
          </div>
          <div className="input-wrap">
            <label htmlFor="batchInput">Batch (Optional)</label>
            <input
              id="batchInput"
              type="text"
              inputMode="numeric"
              value={batch}
              onChange={(event) => {
                const digitsOnly = event.target.value
                  .replace(/\D/g, "")
                  .slice(0, 4);
                onBatchChange(digitsOnly);
              }}
              placeholder="2023 or 23"
              maxLength={4}
            />
          </div>
          <div className="selection-pill">
            Selected: {department} - Semester {semester} - Batch{" "}
            {batch.trim() || "Latest"}
          </div>
        </section>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      <Outlet context={{ department, semester, batch, departments }} />

      <footer className="site-disclaimer" aria-label="Disclaimer">
        <p>
          <strong>Note:</strong> Results, SGPA, and all derived values are
          provisional and may be revised.
        </p>
        <p>
          This website only displays uploaded result PDFs and is not an official
          source of record.
        </p>
      </footer>
    </main>
  );
}
