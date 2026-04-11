import type { ReactNode } from "react";

// ── String class constants ─────────────────────────────────────────────────

export const inputCls =
  "min-h-[40px] px-3 rounded-[10px] border border-[#7f8dd6] bg-white " +
  "text-[var(--foreground)] text-[0.91rem] outline-none w-full " +
  "focus:border-[#3040a0] focus:ring-2 focus:ring-[rgba(48,64,160,0.12)] transition-shadow";

export const btnPrimary =
  "min-h-[40px] self-end rounded-[10px] border-none " +
  "bg-gradient-to-br from-[#3040a0] to-[#000060] text-[#edf5ff] " +
  "font-bold px-4 text-[0.91rem] cursor-pointer whitespace-nowrap " +
  "transition-all hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(28,52,129,0.26)] " +
  "disabled:opacity-55 disabled:cursor-not-allowed";

export const btnSecondary =
  "min-h-[40px] self-end rounded-[10px] border border-[#96a5e6] bg-[#f1f4ff] " +
  "text-[var(--foreground)] font-[650] px-4 text-[0.88rem] cursor-pointer whitespace-nowrap " +
  "transition-all hover:bg-[#e4eaff] hover:shadow-[0_3px_10px_rgba(48,64,160,0.13)]";

// ── Label ──────────────────────────────────────────────────────────────────

export const labelCls =
  "text-[0.72rem] uppercase tracking-[0.04em] font-[650] text-[var(--muted)]";

// ── Table primitives ───────────────────────────────────────────────────────

export const THead = ({ cols }: { cols: string[] }) => (
  <thead className="bg-[#eef2ff] sticky top-0 z-10">
    <tr>
      {cols.map((col) => (
        <th
          key={col}
          className="px-2.5 py-2 text-left text-[0.7rem] uppercase tracking-[0.04em] font-bold text-[var(--muted)] border-b border-[#dbe3ff] whitespace-nowrap"
        >
          {col}
        </th>
      ))}
    </tr>
  </thead>
);

export const Td = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <td className={`px-2.5 py-2 text-sm border-b border-[#dbe3ff] ${className ?? ""}`}>
    {children}
  </td>
);

export const ScrollTable = ({
  cols,
  children,
  maxH = "max-h-72",
}: {
  cols: string[];
  children: ReactNode;
  maxH?: string;
}) => (
  <div className={`overflow-auto ${maxH} border border-[#dbe3ff] rounded-[10px]`}>
    <table className="w-full border-collapse">
      <THead cols={cols} />
      <tbody>{children}</tbody>
    </table>
  </div>
);

// ── Layout blocks ──────────────────────────────────────────────────────────

export const SectionBlock = ({ children }: { children: ReactNode }) => (
  <div className="border border-[#dbe3ff] rounded-[14px] p-4 bg-[#f9fbff] flex flex-col gap-3">
    {children}
  </div>
);

export const ResultBlock = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <div className="border border-[#dbe3ff] rounded-[14px] p-4 bg-[#fffefb] flex flex-col gap-3">
    <p className="text-[0.95rem] font-bold m-0 text-[var(--foreground)]">{title}</p>
    {children}
  </div>
);

export const SectionHead = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => (
  <div>
    <h3 className="m-0 text-[1rem] font-bold text-[var(--foreground)]">{title}</h3>
    {description && <p className="m-0 text-[0.8rem] text-slate-500">{description}</p>}
  </div>
);

// ── Form helpers ───────────────────────────────────────────────────────────

export const InputField = ({
  id,
  label,
  hint,
  children,
  className,
}: {
  id?: string;
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) => (
  <div className={`flex flex-col gap-1 ${className ?? "flex-1 min-w-[160px]"}`}>
    {id ? (
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
    ) : (
      <span className={labelCls}>{label}</span>
    )}
    {children}
    {hint && <p className="text-xs text-slate-500 m-0">{hint}</p>}
  </div>
);

// ── Notices ────────────────────────────────────────────────────────────────

export const Notice = ({
  error,
  children,
}: {
  error?: boolean;
  children: ReactNode;
}) => (
  <p
    className={`text-sm m-0 ${error ? "text-red-700 font-semibold" : "text-[var(--muted)]"}`}
  >
    {children}
  </p>
);

// ── Mini stat tile ─────────────────────────────────────────────────────────

export const StatTile = ({ label, value }: { label: string; value: string | number }) => (
  <div className="border border-dashed border-[#c6ceef] rounded-[10px] bg-[#f7f9ff] px-3 py-2.5">
    <strong className="block text-[0.68rem] uppercase tracking-[0.05em] font-[650] text-[var(--muted)]">
      {label}
    </strong>
    <p className="m-0 mt-1 text-[1.1rem] font-bold text-[var(--foreground)]">{value}</p>
  </div>
);

// ── Tr hover utility ───────────────────────────────────────────────────────

export const trHover = "hover:bg-[#f4f7ff] transition-colors";
