import { useEffect, useState, type ReactNode } from "react";
import Select, { type SingleValue } from "react-select";
import { NavLink, Outlet } from "react-router-dom";
import type { DepartmentOption } from "../types/api";
import { buildBatchSelectOptions } from "../utils/batchOptions";

type DepartmentSelectOption = {
  value: string;
  label: string;
};

type SemesterSelectOption = {
  value: number;
  label: string;
};

type NavigationItem = {
  to: string;
  label: string;
  description: string;
  icon: ReactNode;
  end?: boolean;
};

type AppLayoutProps = {
  departments: DepartmentOption[];
  semesters: number[];
  availableBatches: string[];
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
  availableBatches,
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

  const batchOptions = buildBatchSelectOptions(availableBatches);

  const selectedBatchOption =
    batchOptions.find((option) => option.value === batch.trim()) ?? null;

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem("au-dashboard-sidebar") === "collapsed";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      "au-dashboard-sidebar",
      sidebarCollapsed ? "collapsed" : "expanded",
    );
  }, [sidebarCollapsed]);

  const navigationItems: NavigationItem[] = [
    {
      to: "/",
      label: "Overview",
      description: "Class pass rate and department snapshot",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon-svg">
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="5" rx="1.5" />
          <rect x="13" y="10" width="8" height="11" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
        </svg>
      ),
      end: true,
    },
    {
      to: "/students",
      label: "Students",
      description: "Search one student and inspect subject grades",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon-svg">
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5 20c0-3.3 3-6 7-6s7 2.7 7 6" />
        </svg>
      ),
    },
    {
      to: "/cgpa",
      label: "CGPA",
      description: "Class trends, breakdowns, and student compare",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon-svg">
          <path d="M4 18h16" />
          <path d="M6 16V9" />
          <path d="M12 16V6" />
          <path d="M18 16v-4" />
        </svg>
      ),
    },
    {
      to: "/comparison",
      label: "Comparison",
      description: "Compare grade points across multiple students",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon-svg">
          <path d="M4 7h7" />
          <path d="M4 12h16" />
          <path d="M4 17h10" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="18" cy="17" r="2" />
        </svg>
      ),
    },
    {
      to: "/arrears",
      label: "Arrears",
      description: "Filter and inspect students by arrear count",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon-svg">
          <path d="M12 3v10" />
          <path d="M12 17v.01" />
          <path d="M5 21h14" />
          <path d="M4 21l8-17 8 17" />
        </svg>
      ),
    },
    {
      to: "/rankings",
      label: "Rankings",
      description: "Generate and view rank list quickly",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon-svg">
          <path d="M8 5h8" />
          <path d="M8 9h8" />
          <path d="M8 13h8" />
          <path d="M8 17h8" />
          <path d="M4 5h.01" />
          <path d="M4 9h.01" />
          <path d="M4 13h.01" />
          <path d="M4 17h.01" />
        </svg>
      ),
    },
    {
      to: "/exports",
      label: "Exports",
      description: "Create PDF reports for all major views",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon-svg">
          <path d="M12 4v10" />
          <path d="M8.5 10.5 12 14l3.5-3.5" />
          <rect x="4" y="16" width="16" height="4" rx="1.2" />
        </svg>
      ),
    },
    {
      to: "/imports",
      label: "Imports",
      description: "Import PDF data and manage storage path",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon-svg">
          <path d="M12 20V10" />
          <path d="M8.5 13.5 12 10l3.5 3.5" />
          <rect x="4" y="4" width="16" height="4" rx="1.2" />
        </svg>
      ),
    },
  ];

  return (
    <main
      className={
        sidebarCollapsed
          ? "dashboard-shell sidebar-collapsed"
          : "dashboard-shell"
      }
    >
      <aside className="dashboard-sidebar" aria-label="Navigation sidebar">
        <div className="sidebar-header">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="sidebar-toggle-bar" />
            <span className="sidebar-toggle-bar" />
            <span className="sidebar-toggle-bar" />
          </button>
          <div className="sidebar-title-block">
            <p className="sidebar-title">AU Dashboard</p>
            <p className="sidebar-subtitle">Result Analytics</p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Sections">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={({ isActive }) =>
                isActive ? "nav-pill active" : "nav-pill"
              }
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-copy">
                <span className="nav-pill-title">{item.label}</span>
                <span className="nav-pill-subtitle">{item.description}</span>
              </span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <section className="dashboard-main">
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
            Explore student performance, arrears, rankings, and trend insights
            in one focused workspace.
          </p>
        </header>

        <section className="dashboard-workspace">
          <div className="dashboard-content">
            {error ? <p className="error-banner">{error}</p> : null}

            <Outlet
              context={{
                department,
                semester,
                availableSemesters: semesters,
                batch,
                availableBatches,
                departments,
              }}
            />

            <footer className="site-disclaimer" aria-label="Disclaimer">
              <p>
                <strong>Note:</strong> Results, SGPA, and all derived values are
                provisional and may be revised.
              </p>
              <p>
                This website only displays uploaded result PDFs and is not an
                official source of record.
              </p>
            </footer>
          </div>

          <aside className="panel filters workspace-filters">
            <div className="filters-head">
              <h2>Workspace Filters</h2>
              <p className="hint">
                Applies to all pages, exports, and student searches.
              </p>
            </div>

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
              <label htmlFor="batchSelect">Batch</label>
              <Select<{ value: string; label: string }>
                inputId="batchSelect"
                options={batchOptions}
                value={selectedBatchOption}
                onChange={(
                  option: SingleValue<{ value: string; label: string }>,
                ) => onBatchChange(option?.value ?? "")}
                isDisabled={metaLoading}
                isSearchable={false}
                isClearable
                placeholder="Latest available"
                menuPlacement="auto"
                menuPosition="fixed"
                menuPortalTarget={menuPortalTarget}
                className="rs-single"
                classNamePrefix="rs"
              />
            </div>

            <div className="selection-pill">
              <span className="selection-chip">
                Department: <strong>{department}</strong>
              </span>
              <span className="selection-chip">
                Semester: <strong>{semester}</strong>
              </span>
              <span className="selection-chip">
                Batch: <strong>{batch.trim() || "Latest available"}</strong>
              </span>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
