"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";
import Select, {
  components,
  type MultiValue,
  type MultiValueProps,
  type SingleValue,
  type ValueContainerProps,
} from "react-select";
import { useExplorer } from "./context";
import { type StudentOption } from "./types";
import { cardTone, fmtNumber } from "./utils";

const tabs = [
  { href: "/overview", label: "Overview", icon: "overview" },
  { href: "/student", label: "Student", icon: "student" },
  { href: "/audit", label: "Audit", icon: "audit" },
  { href: "/rankings", label: "Rankings", icon: "rankings" },
  { href: "/arrears", label: "Arrears", icon: "arrears" },
  { href: "/subjects", label: "Subjects", icon: "subjects" },
  { href: "/cgpa", label: "CGPA", icon: "cgpa" },
  { href: "/comparisons", label: "Comparisons", icon: "comparisons" },
] as const;

type TabIconName = (typeof tabs)[number]["icon"];
type StringOption = { value: string; label: string };
type NumberOption = { value: number; label: string };

const selectPortalStyles = {
  menuPortal: (base: Record<string, unknown>) => ({ ...base, zIndex: 70 }),
};

const TabIcon = ({ name }: { name: TabIconName }) => {
  const common = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "overview") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="5" rx="1.5" />
        <rect x="13" y="10" width="8" height="11" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
      </svg>
    );
  }
  if (name === "student") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5.5 20c1.2-3.4 3.7-5.1 6.5-5.1s5.3 1.7 6.5 5.1" />
      </svg>
    );
  }
  if (name === "rankings") {
    return (
      <svg {...common}>
        <path d="M5 19V9" />
        <path d="M12 19V5" />
        <path d="M19 19v-7" />
      </svg>
    );
  }
  if (name === "audit") {
    return (
      <svg {...common}>
        <path d="M8 4h8" />
        <path d="M7 8h10" />
        <path d="M7 12h10" />
        <path d="M7 16h6" />
        <circle cx="17" cy="16" r="3" />
      </svg>
    );
  }
  if (name === "arrears") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 8v5" />
        <path d="M12 16h.01" />
      </svg>
    );
  }
  if (name === "subjects") {
    return (
      <svg {...common}>
        <path d="M6 4h10a2 2 0 0 1 2 2v12H8a2 2 0 0 0-2 2V4z" />
        <path d="M8 20h10" />
      </svg>
    );
  }
  if (name === "cgpa") {
    return (
      <svg {...common}>
        <path d="M4 18l5-6 4 3 7-9" />
        <path d="M18 6h2v2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M7 7h10v10H7z" />
      <path d="M4 12h3M17 12h3M12 4v3M12 17v3" />
    </svg>
  );
};

export const ExplorerShell = ({ children }: { children: ReactNode }) => {
  const {
    meta,
    summaryCards,
    studentsDirectory,
    department,
    setDepartment,
    selectedSemesters,
    setSelectedSemesters,
    batch,
    setBatch,
    topK,
    setTopK,
    markPanelsLoading,
  } = useExplorer();
  const pathname = usePathname();
  const router = useRouter();
  const [lookupStudent, setLookupStudent] = useState<StudentOption | null>(
    null,
  );
  const [lookupInput, setLookupInput] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const activeTabLabel = useMemo(
    () => tabs.find((tab) => tab.href === pathname)?.label ?? "Overview",
    [pathname],
  );

  const isTopKApplicable = pathname === "/rankings";
  const isWorkspaceRegnoApplicable =
    pathname !== "/student" && pathname !== "/audit";

  const departmentOptions = useMemo<StringOption[]>(
    () =>
      (meta.data?.departments ?? []).map((item) => ({
        value: item.name,
        label: `${item.name} (${item.code})`,
      })),
    [meta.data?.departments],
  );

  const semesterOptions = useMemo<NumberOption[]>(
    () =>
      [...(meta.data?.semesters ?? [])]
        .sort((a, b) => b - a)
        .map((item) => ({ value: item, label: `Semester ${item}` })),
    [meta.data?.semesters],
  );

  const batchOptions = useMemo<StringOption[]>(
    () => [
      { value: "", label: "All batches (latest)" },
      ...(meta.data?.batches ?? []).map((item) => ({
        value: item,
        label: item,
      })),
    ],
    [meta.data?.batches],
  );

  const topKOptions = useMemo<NumberOption[]>(
    () =>
      [10, 25, 50, 100, 200].map((value) => ({ value, label: String(value) })),
    [],
  );

  const studentOptions = useMemo<StudentOption[]>(() => {
    if (!studentsDirectory.data) {
      return [];
    }
    return studentsDirectory.data.map((item) => ({
      value: item.regno,
      label: `${item.name} (${item.regno})`,
    }));
  }, [studentsDirectory.data]);

  const selectedDepartmentOption =
    departmentOptions.find((item) => item.value === department) ?? null;

  const selectedSemesterOptions = selectedSemesters
    .map((value) => semesterOptions.find((item) => item.value === value))
    .filter((item): item is NumberOption => item != null);

  const selectedBatchOption =
    batchOptions.find((item) => item.value === batch) ?? null;

  const selectedTopKOption =
    topKOptions.find((item) => item.value === topK) ?? null;

  const areAllSemestersSelected =
    semesterOptions.length > 0 &&
    selectedSemesters.length === semesterOptions.length;

  const allSemestersLabel = useMemo(() => {
    if (semesterOptions.length === 0) {
      return "All Semesters";
    }

    const sorted = [...semesterOptions]
      .map((item) => item.value)
      .sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    return min === max ? `Sem ${min}` : `Sem ${min}-${max}`;
  }, [semesterOptions]);

  const semesterSelectComponents = useMemo(
    () => ({
      MultiValue: (props: MultiValueProps<NumberOption, true>) => {
        if (areAllSemestersSelected) {
          return null;
        }
        return <components.MultiValue {...props} />;
      },
      ValueContainer: (props: ValueContainerProps<NumberOption, true>) => {
        if (!areAllSemestersSelected) {
          return <components.ValueContainer {...props} />;
        }

        return (
          <components.ValueContainer {...props}>
            <span className="text-[0.85rem] text-[var(--foreground)] mr-1">
              {allSemestersLabel}
            </span>
            {props.children}
          </components.ValueContainer>
        );
      },
    }),
    [allSemestersLabel, areAllSemestersSelected],
  );

  const openStudentProfile = () => {
    const typedRegno = lookupInput.trim().toUpperCase();
    const matched = studentOptions.find(
      (item) => item.value.toUpperCase() === typedRegno,
    );
    const regno = lookupStudent?.value ?? matched?.value;
    if (regno) {
      router.push(`/student?regno=${encodeURIComponent(regno)}`);
      return;
    }
    router.push("/student");
  };

  return (
    <main className="min-h-screen w-full">
      {/* Three-column layout */}
      <div
        className={`grid min-h-screen items-stretch ${
          sidebarCollapsed
            ? "grid-cols-[72px_minmax(0,1fr)_minmax(300px,360px)]"
            : "grid-cols-[minmax(88px,268px)_minmax(0,1fr)_minmax(300px,360px)]"
        }`}
      >
        {/* ── Left Sidebar ─────────────────────────────── */}
        <aside
          className="sticky top-0 flex flex-col gap-3 max-h-screen min-h-screen
            rounded-r-[18px] border border-l-0 border-[var(--panel-border)]
            bg-[var(--card)] backdrop-blur-sm shadow-[0_8px_24px_rgba(22,50,99,0.09)]
            py-4 px-3.5 overflow-hidden"
        >
          {/* Branding */}
          <div className="flex flex-col gap-2">
            <Image
              src="/mce-logo-2-og.png"
              alt="Mookambigai College of Engineering"
              className={`object-contain block ${sidebarCollapsed ? "h-6 w-auto" : "h-9 w-auto"}`}
              width={164}
              height={32}
            />
            <Image
              src="/iqac-logo-og.png"
              alt="IQAC"
              className={`object-contain block ${sidebarCollapsed ? "h-5 w-auto" : "h-7 w-auto"}`}
              width={92}
              height={30}
            />
            {!sidebarCollapsed && (
              <div className="flex flex-col gap-0.5 pt-0.5">
                <p className="m-0 text-sm font-bold text-[var(--foreground)] leading-tight">
                  MCE Results Explorer
                </p>
                <p className="m-0 text-[0.67rem] uppercase tracking-[0.06em] text-[var(--muted)]">
                  Accreditation Analytics Suite
                </p>
              </div>
            )}
          </div>

          {/* Collapse button */}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="w-full min-h-[32px] rounded-[10px] border border-[#96a5e6]
              bg-[#f1f4ff] text-[#1d2d7a] text-[0.72rem] font-bold uppercase tracking-[0.04em]
              px-2 cursor-pointer transition-colors hover:bg-[#e4eaff] hover:border-[#7f8dd6]"
          >
            {sidebarCollapsed ? "▶" : "Collapse"}
          </button>

          {/* Nav */}
          <nav
            className="flex flex-col gap-1.5 overflow-y-auto"
            aria-label="Explorer pages"
          >
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                title={sidebarCollapsed ? tab.label : undefined}
                className={`flex items-center gap-2.5 no-underline rounded-[10px] border
                  px-2.5 py-2.5 text-[0.875rem] font-[650] transition-all duration-150
                  ${
                    pathname === tab.href
                      ? "bg-gradient-to-br from-[#3040a0] to-[#000060] text-[#f7fbff] border-transparent shadow-[0_2px_10px_rgba(48,64,160,0.3)]"
                      : "border-transparent text-[var(--muted)] hover:bg-[#eef1ff] hover:border-[#b8c4ef] hover:text-[var(--foreground)]"
                  }
                  ${sidebarCollapsed ? "justify-center" : ""}`}
              >
                <span className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
                  <TabIcon name={tab.icon} />
                </span>
                {!sidebarCollapsed && (
                  <span className="whitespace-nowrap">{tab.label}</span>
                )}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="grid grid-rows-[auto_minmax(0,1fr)] gap-3.5 min-w-0 p-3.5">
          <header
            className="border border-[var(--panel-border)] rounded-[18px] bg-[var(--card)]
              shadow-[0_8px_24px_rgba(22,50,99,0.09)] backdrop-blur-sm p-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="m-0 text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)] font-bold">
                  Workspace Filters
                </p>
                <h2 className="m-0 text-[1.05rem] font-[750] text-[var(--foreground)]">
                  {activeTabLabel}
                </h2>
              </div>
              {meta.loading && (
                <p className="text-[0.84rem] text-[var(--muted)] m-0">
                  Loading metadata...
                </p>
              )}
              {meta.error && (
                <p className="text-[0.84rem] text-red-700 font-semibold m-0">
                  {meta.error}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1.2fr_1fr_0.7fr_1.6fr_auto] gap-2.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.72rem] uppercase tracking-[0.04em] font-[650] text-[var(--muted)]">
                  Department
                </span>
                <Select<StringOption, false>
                  inputId="workspace-department"
                  value={selectedDepartmentOption}
                  onChange={(option: SingleValue<StringOption>) => {
                    markPanelsLoading();
                    setDepartment(option?.value ?? "");
                  }}
                  options={departmentOptions}
                  isSearchable
                  classNamePrefix="rs"
                  menuPortalTarget={
                    typeof window !== "undefined" ? document.body : null
                  }
                  styles={selectPortalStyles}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[0.72rem] uppercase tracking-[0.04em] font-[650] text-[var(--muted)]">
                  Semesters
                </span>
                <Select<NumberOption, true>
                  inputId="workspace-semesters"
                  value={selectedSemesterOptions}
                  onChange={(options: MultiValue<NumberOption>) => {
                    markPanelsLoading();
                    const semesters = [...options]
                      .map((item) => item.value)
                      .sort((a, b) => b - a);
                    setSelectedSemesters(semesters);
                  }}
                  options={semesterOptions}
                  isMulti
                  closeMenuOnSelect={false}
                  isSearchable={false}
                  components={semesterSelectComponents}
                  classNamePrefix="rs"
                  menuPortalTarget={
                    typeof window !== "undefined" ? document.body : null
                  }
                  styles={selectPortalStyles}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[0.72rem] uppercase tracking-[0.04em] font-[650] text-[var(--muted)]">
                  Batch
                </span>
                <Select<StringOption, false>
                  inputId="workspace-batch"
                  value={selectedBatchOption}
                  onChange={(option: SingleValue<StringOption>) => {
                    markPanelsLoading();
                    setBatch(option?.value ?? "");
                  }}
                  options={batchOptions}
                  isSearchable
                  classNamePrefix="rs"
                  menuPortalTarget={
                    typeof window !== "undefined" ? document.body : null
                  }
                  styles={selectPortalStyles}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[0.72rem] uppercase tracking-[0.04em] font-[650] text-[var(--muted)]">
                  Top K
                </span>
                <Select<NumberOption, false>
                  inputId="workspace-topk"
                  value={selectedTopKOption}
                  onChange={(option: SingleValue<NumberOption>) => {
                    markPanelsLoading();
                    setTopK(option?.value ?? 10);
                  }}
                  options={topKOptions}
                  isSearchable={false}
                  isDisabled={!isTopKApplicable}
                  classNamePrefix="rs"
                  menuPortalTarget={
                    typeof window !== "undefined" ? document.body : null
                  }
                  styles={selectPortalStyles}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[0.72rem] uppercase tracking-[0.04em] font-[650] text-[var(--muted)]">
                  RegNo Search
                </span>
                <Select<StudentOption, false>
                  inputId="workspace-regno-search"
                  options={studentOptions}
                  value={lookupStudent}
                  onChange={(option: SingleValue<StudentOption>) =>
                    setLookupStudent(option)
                  }
                  onInputChange={(value, metaAction) => {
                    if (metaAction.action === "input-change") {
                      setLookupInput(value);
                    }
                  }}
                  isLoading={studentsDirectory.loading}
                  isClearable
                  isSearchable
                  isDisabled={!isWorkspaceRegnoApplicable}
                  placeholder="Search name or regno"
                  classNamePrefix="rs"
                  menuPortalTarget={
                    typeof window !== "undefined" ? document.body : null
                  }
                  styles={selectPortalStyles}
                />
              </label>

              <button
                type="button"
                onClick={openStudentProfile}
                disabled={!isWorkspaceRegnoApplicable}
                className="min-h-[40px] self-end rounded-[10px] border-none bg-gradient-to-br from-[#3040a0] to-[#000060]
                  text-[#edf5ff] font-bold px-4 text-[0.91rem] cursor-pointer whitespace-nowrap
                  transition-all hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(28,52,129,0.26)]
                  disabled:opacity-55 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                Open Student
              </button>
            </div>
          </header>

          <section
            className="border border-[var(--panel-border)] rounded-[18px] bg-[var(--card)]
              shadow-[0_8px_24px_rgba(22,50,99,0.09)] backdrop-blur-sm overflow-auto"
          >
            {children}
          </section>
        </section>

        <aside
          className="sticky top-0 flex flex-col gap-3 max-h-screen min-h-screen overflow-auto
            rounded-l-[18px] border border-r-0 border-[var(--panel-border)]
            bg-[var(--card)] backdrop-blur-sm shadow-[0_8px_24px_rgba(22,50,99,0.09)]
            p-4"
        >
          <header>
            <p className="m-0 text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)] font-bold">
              KPI Panel
            </p>
            <h2 className="m-0 text-[1.15rem] font-[750] text-[var(--foreground)]">
              Summary
            </h2>
          </header>

          <div className="grid grid-cols-2 gap-2.5">
            {summaryCards.map((card, index) => (
              <article
                key={card.label}
                style={{ borderColor: cardTone[index % cardTone.length] }}
                className="border-2 rounded-[14px] bg-[#f9fbff] px-3 py-3 flex flex-col gap-1 min-h-[92px]"
              >
                <p className="m-0 text-[0.66rem] uppercase tracking-[0.07em] text-[var(--muted)] font-[650]">
                  {card.label}
                </p>
                <h3 className="m-0 text-[1.25rem] font-[750] leading-tight text-[var(--foreground)]">
                  {fmtNumber(card.value)}
                  {card.suffix ?? ""}
                </h3>
              </article>
            ))}
          </div>

          {studentsDirectory.error && (
            <p className="text-sm font-semibold text-red-700 m-0">
              {studentsDirectory.error}
            </p>
          )}
        </aside>
      </div>
    </main>
  );
};
