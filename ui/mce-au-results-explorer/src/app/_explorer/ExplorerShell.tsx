"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";
import { useExplorer } from "./context";
import { cardTone, fmtNumber } from "./utils";

const tabs = [
  { href: "/overview", label: "Overview", icon: "overview" },
  { href: "/student", label: "Student", icon: "student" },
  { href: "/rankings", label: "Rankings", icon: "rankings" },
  { href: "/arrears", label: "Arrears", icon: "arrears" },
  { href: "/subjects", label: "Subjects", icon: "subjects" },
  { href: "/cgpa", label: "CGPA", icon: "cgpa" },
  { href: "/comparisons", label: "Comparisons", icon: "comparisons" },
] as const;

type TabIconName = (typeof tabs)[number]["icon"];

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
    department,
    setDepartment,
    semester,
    setSemester,
    batch,
    setBatch,
    topK,
    setTopK,
    markPanelsLoading,
  } = useExplorer();
  const pathname = usePathname();
  const router = useRouter();
  const [regnoInput, setRegnoInput] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const activeTabLabel = useMemo(
    () => tabs.find((tab) => tab.href === pathname)?.label ?? "Overview",
    [pathname],
  );

  const openStudentProfile = () => {
    const regno = regnoInput.trim();
    if (regno.length > 0) {
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
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="w-full min-h-[32px] rounded-[10px] border border-[#96a5e6]
              bg-[#f1f4ff] text-[#1d2d7a] text-[0.72rem] font-bold uppercase tracking-[0.04em]
              px-2 cursor-pointer transition-colors hover:bg-[#e4eaff] hover:border-[#7f8dd6]"
          >
            {sidebarCollapsed ? "▶" : "Collapse"}
          </button>

          {/* Nav */}
          <nav className="flex flex-col gap-1.5 overflow-y-auto" aria-label="Explorer pages">
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
                {!sidebarCollapsed && <span className="whitespace-nowrap">{tab.label}</span>}
              </Link>
            ))}
          </nav>
        </aside>

        {/* ── Centre workspace ──────────────────────────── */}
        <section className="grid grid-rows-[auto_minmax(0,1fr)] gap-3.5 min-w-0 p-3.5">
          {/* Metric cards */}
          <div className="grid grid-cols-4 gap-3">
            {summaryCards.map((card, index) => (
              <article
                key={card.label}
                style={{ borderColor: cardTone[index % cardTone.length] }}
                className="border-2 rounded-[14px] bg-[#f9fbff] px-4 py-3.5 flex flex-col gap-1 min-h-[96px]"
              >
                <p className="m-0 text-[0.72rem] uppercase tracking-[0.08em] text-[var(--muted)] font-[600]">
                  {card.label}
                </p>
                <h2 className="m-0 text-[1.7rem] font-[750] leading-tight text-[var(--foreground)]">
                  {fmtNumber(card.value)}
                  {card.suffix ?? ""}
                </h2>
              </article>
            ))}
          </div>

          {/* Page panel */}
          <section
            className="border border-[var(--panel-border)] rounded-[18px] bg-[var(--card)]
              shadow-[0_8px_24px_rgba(22,50,99,0.09)] backdrop-blur-sm overflow-auto"
          >
            {children}
          </section>
        </section>

        {/* ── Right input pane ──────────────────────────── */}
        <aside
          className="sticky top-0 flex flex-col gap-0 max-h-screen min-h-screen overflow-auto
            rounded-l-[18px] border border-r-0 border-[var(--panel-border)]
            bg-[var(--card)] backdrop-blur-sm shadow-[0_8px_24px_rgba(22,50,99,0.09)]
            p-4"
        >
          {/* Header */}
          <header className="mb-3.5 pb-3.5 border-b border-[var(--panel-border)]">
            <p className="m-0 text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)] font-bold">
              Workspace
            </p>
            <h2 className="m-0 text-[1.15rem] font-[750] text-[var(--foreground)]">
              {activeTabLabel}
            </h2>
          </header>

          {/* Filters */}
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-3">
              {/* Department */}
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.72rem] uppercase tracking-[0.04em] font-[650] text-[var(--muted)]">
                  Department
                </span>
                <select
                  value={department}
                  onChange={(e) => { markPanelsLoading(); setDepartment(e.target.value); }}
                  className="min-h-[40px] px-3 rounded-[10px] border border-[#7f8dd6] bg-white text-[var(--foreground)]
                    text-[0.91rem] outline-none focus:border-[#3040a0] focus:ring-2 focus:ring-[rgba(48,64,160,0.12)]
                    transition-shadow"
                >
                  {(meta.data?.departments ?? []).map((item) => (
                    <option key={item.code} value={item.name}>
                      {item.name} ({item.code})
                    </option>
                  ))}
                </select>
              </label>

              {/* Semester */}
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.72rem] uppercase tracking-[0.04em] font-[650] text-[var(--muted)]">
                  Semester
                </span>
                <select
                  value={semester || ""}
                  onChange={(e) => { markPanelsLoading(); setSemester(Number(e.target.value)); }}
                  className="min-h-[40px] px-3 rounded-[10px] border border-[#7f8dd6] bg-white text-[var(--foreground)]
                    text-[0.91rem] outline-none focus:border-[#3040a0] focus:ring-2 focus:ring-[rgba(48,64,160,0.12)]
                    transition-shadow"
                >
                  {(meta.data?.semesters ?? []).map((item) => (
                    <option key={item} value={item}>
                      Semester {item}
                    </option>
                  ))}
                </select>
              </label>

              {/* Batch */}
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.72rem] uppercase tracking-[0.04em] font-[650] text-[var(--muted)]">
                  Batch
                </span>
                <select
                  value={batch}
                  onChange={(e) => { markPanelsLoading(); setBatch(e.target.value); }}
                  className="min-h-[40px] px-3 rounded-[10px] border border-[#7f8dd6] bg-white text-[var(--foreground)]
                    text-[0.91rem] outline-none focus:border-[#3040a0] focus:ring-2 focus:ring-[rgba(48,64,160,0.12)]
                    transition-shadow"
                >
                  <option value="">All batches (latest)</option>
                  {(meta.data?.batches ?? []).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              {/* Top K */}
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.72rem] uppercase tracking-[0.04em] font-[650] text-[var(--muted)]">
                  Top K
                </span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={topK}
                  onChange={(e) => { markPanelsLoading(); setTopK(Math.max(1, Number(e.target.value) || 10)); }}
                  className="min-h-[40px] px-3 rounded-[10px] border border-[#7f8dd6] bg-white text-[var(--foreground)]
                    text-[0.91rem] outline-none focus:border-[#3040a0] focus:ring-2 focus:ring-[rgba(48,64,160,0.12)]
                    transition-shadow"
                />
              </label>
            </div>

            {/* Student lookup */}
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Lookup by register number"
                value={regnoInput}
                onChange={(e) => setRegnoInput(e.target.value)}
                className="min-h-[40px] px-3 rounded-[10px] border border-[#7f8dd6] bg-white text-[var(--foreground)]
                  text-[0.91rem] outline-none focus:border-[#3040a0] focus:ring-2 focus:ring-[rgba(48,64,160,0.12)]
                  transition-shadow"
              />
              <button
                type="button"
                onClick={openStudentProfile}
                className="min-h-[40px] rounded-[10px] border-none bg-gradient-to-br from-[#3040a0] to-[#000060]
                  text-[#edf5ff] font-bold px-4 text-[0.91rem] cursor-pointer
                  transition-all hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(28,52,129,0.26)]"
              >
                Open Student Profile
              </button>
            </div>

            {/* Status messages */}
            {meta.loading && <p className="text-[0.84rem] text-[var(--muted)] m-0">Loading metadata...</p>}
            {meta.error && <p className="text-[0.84rem] text-red-700 font-semibold m-0">{meta.error}</p>}
          </div>
        </aside>
      </div>
    </main>
  );
};
