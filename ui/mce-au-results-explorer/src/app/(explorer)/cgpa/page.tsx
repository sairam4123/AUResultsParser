"use client";

import Link from "next/link";

const links = [
  {
    href: "/rankings",
    title: "Class CGPA Ranking",
    description:
      "View CGPA-based class ranking and SGPA distribution for the selected semesters.",
  },
  {
    href: "/student",
    title: "Student CGPA Breakdown",
    description:
      "Open a student profile to inspect full semester-wise and subject-wise CGPA calculations.",
  },
  {
    href: "/comparisons",
    title: "CGPA Comparisons",
    description:
      "Compare multiple students across semesters with SGPA and cumulative CGPA trends.",
  },
];

export default function CgpaPage() {
  return (
    <div className="p-4 overflow-auto max-h-[calc(100vh-180px)] flex flex-col gap-4">
      <section className="border border-[#dbe3ff] rounded-[14px] bg-[#f9fbff] p-4 flex flex-col gap-2">
        <h3 className="m-0 text-[1rem] font-bold text-[var(--foreground)]">
          CGPA Tools Moved
        </h3>
        <p className="m-0 text-[0.84rem] text-slate-600">
          The previous all-in-one CGPA workspace has been split into focused
          pages. Use the links below.
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="border border-[#dbe3ff] rounded-[14px] bg-white p-4 flex flex-col gap-2 no-underline
              transition-all hover:-translate-y-px hover:shadow-[0_8px_20px_rgba(48,64,160,0.15)]"
          >
            <p className="m-0 text-[0.95rem] font-bold text-[var(--foreground)]">
              {item.title}
            </p>
            <p className="m-0 text-[0.8rem] text-slate-600">
              {item.description}
            </p>
            <span className="mt-1 text-[0.78rem] font-semibold text-[#3040a0]">
              Open
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
