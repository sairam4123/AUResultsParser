"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Select from "react-select";
import { useExplorer } from "./context";
import { cardTone, fmtNumber } from "./utils";

// ── Nav tabs ───────────────────────────────────────────────────────────────

const tabs = [
  { href: "/overview", label: "Overview", icon: "overview" },
  { href: "/student", label: "Student", icon: "student" },
  { href: "/rankings", label: "Rankings", icon: "rankings" },
  { href: "/arrears", label: "Arrears", icon: "arrears" },
  { href: "/subjects", label: "Subjects", icon: "subjects" },
  { href: "/cgpa", label: "CGPA", icon: "cgpa" },
  { href: "/comparisons", label: "Comparisons", icon: "comparisons" },
  { href: "/audit", label: "Audit", icon: "audit" },
] as const;

type TabIconName = (typeof tabs)[number]["icon"];

const TabIcon = ({ name }: { name: TabIconName }) => {
  const p = {
    width: 17, height: 17, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.8,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "overview") return <svg {...p}><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="10" width="8" height="11" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /></svg>;
  if (name === "student") return <svg {...p}><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20c1.2-3.4 3.7-5.1 6.5-5.1s5.3 1.7 6.5 5.1" /></svg>;
  if (name === "rankings") return <svg {...p}><path d="M5 19V9" /><path d="M12 19V5" /><path d="M19 19v-7" /></svg>;
  if (name === "arrears") return <svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 8v5" /><path d="M12 16h.01" /></svg>;
  if (name === "subjects") return <svg {...p}><path d="M6 4h10a2 2 0 0 1 2 2v12H8a2 2 0 0 0-2 2V4z" /><path d="M8 20h10" /></svg>;
  if (name === "cgpa") return <svg {...p}><path d="M4 18l5-6 4 3 7-9" /><path d="M18 6h2v2" /></svg>;
  if (name === "audit") return <svg {...p}><path d="M9 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6" /><path d="M9 16h3" /></svg>;
  return <svg {...p}><path d="M7 7h10v10H7z" /><path d="M4 12h3M17 12h3M12 4v3M12 17v3" /></svg>;
};

type Opt = { value: string; label: string };

// ── Shell ──────────────────────────────────────────────────────────────────

export const ExplorerShell = ({ children }: { children: ReactNode }) => {
  const {
    meta, summaryCards,
    department, setDepartment,
    semester, semesters, setSemesters,
    batch, setBatch,
    topK, setTopK,
    markPanelsLoading,
    // dataSource,
  } = useExplorer();

  const pathname = usePathname();
  const router = useRouter();
  const [regnoInput, setRegnoInput] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Portal target for react-select — avoids backdrop-blur stacking context trapping menus
  const portalRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    portalRef.current = document.body;
    setMounted(true);
  }, []);

  const activeTabLabel = useMemo(
    () => tabs.find((t) => t.href === pathname)?.label ?? "Overview",
    [pathname],
  );

  const topKActive = pathname === "/rankings";

  const openStudentProfile = () => {
    const regno = regnoInput.trim();
    router.push(regno ? `/student?regno=${encodeURIComponent(regno)}` : "/student");
  };

  // ── Select options ─────────────────────────────────────────────────────

  const deptOptions = useMemo<Opt[]>(() =>
    (meta.data?.departments ?? []).map((d) => ({ value: d.name, label: `${d.name} (${d.code})` })),
    [meta.data],
  );
  const semesterOptions = useMemo<Opt[]>(() =>
    (meta.data?.semesters ?? []).map((s) => ({ value: String(s), label: `Sem ${s}` })),
    [meta.data],
  );
  const batchOptions = useMemo<Opt[]>(() => [
    { value: "", label: "All batches" },
    ...(meta.data?.batches ?? []).map((b) => ({ value: b, label: b })),
  ], [meta.data]);

  // Shared react-select props — portal to body so backdrop-blur doesn't trap the menu
  const rsShared = {
    classNamePrefix: "rs",
    menuPortalTarget: mounted ? portalRef.current! : undefined,
    styles: { menuPortal: (base: object) => ({ ...base, zIndex: 9999 }) },
  } as const;

  const panelCls = "border border-[var(--panel-border)] bg-[var(--card)] shadow-[0_8px_24px_rgba(22,50,99,0.09)]";

  return (
    <main className="min-h-screen w-full">
      <div
        className={`grid min-h-screen items-stretch ${sidebarCollapsed
          ? "grid-cols-[72px_minmax(0,1fr)_minmax(280px,320px)]"
          : "grid-cols-[minmax(88px,256px)_minmax(0,1fr)_minmax(280px,320px)]"
          }`}
      >
        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside
          className={`sticky top-0 flex flex-col gap-2.5 max-h-screen min-h-screen overflow-hidden
            rounded-r-[18px] border border-l-0 ${panelCls} py-4 px-3`}
        >
          <div className="flex flex-col gap-2">
            <Image
              src="/mce-logo-2-og.png" alt="Mookambigai College of Engineering"
              className={`object-contain block ${sidebarCollapsed ? "h-5 w-auto" : "h-8 w-auto"}`}
              width={164} height={32}
            />
            <Image
              src="/iqac-logo-og.png" alt="IQAC"
              className={`object-contain block ${sidebarCollapsed ? "h-5 w-auto" : "h-7 w-auto"}`}
              width={92} height={30}
            />
            {!sidebarCollapsed && (
              <div className="flex flex-col gap-0.5">
                <p className="m-0 text-[0.88rem] font-bold text-[var(--foreground)] leading-tight">
                  MCE Results Explorer
                </p>
                <p className="m-0 text-[0.63rem] uppercase tracking-[0.06em] text-[var(--muted)]">
                  Accreditation Analytics Suite
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="w-full min-h-[28px] rounded-[8px] border border-[#96a5e6] bg-[#f1f4ff]
              text-[#1d2d7a] text-[0.66rem] font-bold uppercase tracking-[0.05em]
              cursor-pointer transition-colors hover:bg-[#e4eaff]"
          >
            {sidebarCollapsed ? "▶" : "Collapse"}
          </button>

          <nav className="flex flex-col gap-1 overflow-y-auto" aria-label="Explorer pages">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                title={sidebarCollapsed ? tab.label : undefined}
                className={`flex items-center gap-2.5 no-underline rounded-[9px] border
                  px-2.5 py-[9px] text-[0.875rem] font-[650] transition-all duration-150
                  ${pathname === tab.href
                    ? "bg-gradient-to-br from-[#3040a0] to-[#000060] text-[#f7fbff] border-transparent shadow-[0_2px_10px_rgba(48,64,160,0.28)]"
                    : "border-transparent text-[var(--muted)] hover:bg-[#eef1ff] hover:border-[#c4ccee] hover:text-[var(--foreground)]"
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

        {/* ── Centre column ────────────────────────────────────────────── */}
        <section className="grid grid-rows-[auto_minmax(0,1fr)] gap-2.5 min-w-0 p-2.5">

          {/* Filter + search bar — replaces KPI cards */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-[14px] ${panelCls}`}>

            {/* Dept — reduced size */}
            <div className="w-[240px] shrink-0">
              <Select<Opt>
                {...rsShared}
                aria-label="Department"
                options={deptOptions}
                value={deptOptions.find((o) => o.value === department) ?? null}
                onChange={(opt) => { markPanelsLoading(); if (opt) setDepartment(opt.value); }}
                isLoading={meta.loading}
                placeholder="Department…"
              />
            </div>

            {/* Semester — multi-select */}
            <div className="w-[200px] flex-1 shrink-0">
              <Select<Opt, true>
                {...rsShared}
                aria-label="Semester"
                isMulti
                isSearchable={false}
                options={semesterOptions}
                value={semesterOptions.filter((o) => semesters.includes(Number(o.value)))}
                onChange={(opts) => {
                  const next = opts.map((o) => Number(o.value));
                  if (next.length > 0) { markPanelsLoading(); setSemesters(next); }
                }}
                isLoading={meta.loading}
                placeholder="Semester…"
              />
            </div>


            {/* Batch */}
            <div className="w-[130px] shrink-0">
              <Select<Opt>
                {...rsShared}
                aria-label="Batch"
                isSearchable={false}
                options={batchOptions}
                value={batchOptions.find((o) => o.value === batch) ?? batchOptions[0] ?? null}
                onChange={(opt) => { markPanelsLoading(); setBatch(opt?.value ?? ""); }}
                isLoading={meta.loading}
                placeholder="Batch…"
              />
            </div>

            {/* Top K — disabled on non-rankings */}
            <div
              className={`flex items-center gap-1.5 min-h-[40px] bg-white border rounded-[10px] px-2.5
                transition-opacity w-[84px] shrink-0
                ${topKActive
                  ? "border-[#7f8dd6] opacity-100"
                  : "border-[#d0d4ec] opacity-40 pointer-events-none"
                }`}
              title={topKActive ? undefined : "Top K only applies on the Rankings page"}
            >
              <span className="text-[0.68rem] font-bold text-[var(--muted)] shrink-0 uppercase tracking-[0.04em]">Top</span>
              <input
                type="number"
                min={1}
                max={200}
                value={topK}
                disabled={!topKActive}
                onChange={(e) => { markPanelsLoading(); setTopK(Math.max(1, Number(e.target.value) || 10)); }}
                className="w-full border-none outline-none text-[0.91rem] text-[var(--foreground)] bg-transparent"
              />
            </div>

            {/* Divider */}
            <div className="w-px h-7 bg-[var(--panel-border)] shrink-0" />

            {/* Student lookup */}
            <input
              type="text"
              placeholder="Search by register number…"
              value={regnoInput}
              onChange={(e) => setRegnoInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && openStudentProfile()}
              className="min-w-[40ch] min-h-[40px] max-w-[50ch] px-3 rounded-[10px] border border-[#7f8dd6] bg-white
                text-[var(--foreground)] text-[0.91rem] outline-none
                focus:border-[#3040a0] focus:ring-2 focus:ring-[rgba(48,64,160,0.12)] transition-shadow"
            />
            <button
              type="button"
              onClick={openStudentProfile}
              className="min-h-[40px] shrink-0 rounded-[10px] border-none
                bg-gradient-to-br from-[#3040a0] to-[#000060] text-[#edf5ff]
                font-bold px-4 text-[0.88rem] cursor-pointer whitespace-nowrap
                transition-all hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(28,52,129,0.26)]"
            >
              View Profile
            </button>
          </div>

          {/* Page content panel */}
          <section className={`rounded-[18px] ${panelCls} overflow-auto`}>
            {children}
          </section>
        </section>

        {/* ── Right workspace — KPIs + page context ───────────────────── */}
        <aside
          className={`sticky top-0 flex flex-col max-h-screen min-h-screen overflow-hidden
            rounded-l-[18px] border border-r-0 ${panelCls}`}
        >
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-[var(--panel-border)] shrink-0">
            <p className="m-0 text-[0.64rem] uppercase tracking-[0.08em] text-[var(--muted)] font-bold">
              Workspace
            </p>
            <h2 className="m-0 text-[1.1rem] font-[750] text-[var(--foreground)]">
              {activeTabLabel}
            </h2>
          </div>

          {/* KPI tiles */}
          <div className="px-4 pt-3.5 pb-2">
            <p className="m-0 mb-2 text-[0.64rem] uppercase tracking-[0.06em] font-bold text-[var(--muted)]">
              Summary
            </p>
            <div className="grid grid-cols-2 gap-2">
              {summaryCards.map((card, index) => (
                <div
                  key={card.label}
                  style={{ borderColor: cardTone[index % cardTone.length] }}
                  className="border-2 rounded-[12px] bg-[#f9fbff] px-3 py-2.5 flex flex-col gap-0.5"
                >
                  <p className="m-0 text-[0.66rem] uppercase tracking-[0.07em] text-[var(--muted)] font-[600]">
                    {card.label}
                  </p>
                  <p className="m-0 text-[1.45rem] font-[750] leading-tight text-[var(--foreground)]">
                    {fmtNumber(card.value)}{card.suffix ?? ""}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="px-4 pb-3">
            {meta.loading && (
              <p className="text-[0.78rem] text-[var(--muted)] m-0">Loading metadata…</p>
            )}
            {meta.error && (
              <p className="text-[0.78rem] text-red-700 font-semibold m-0">{meta.error}</p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
};
