import { Link, useOutletContext } from "react-router-dom";
import type { LayoutOutletContext } from "../layout/layoutContext";

type ExportRouteCard = {
  title: string;
  description: string;
  to: string;
  action: string;
};

const exportCards: ExportRouteCard[] = [
  {
    title: "Student Result PDF",
    description:
      "Open Student Lookup and export the selected student's semester result PDF.",
    to: "/students",
    action: "Go to Students",
  },
  {
    title: "Comparison PDF",
    description:
      "Open Comparison page, generate a comparison, then export the table as PDF.",
    to: "/comparison",
    action: "Go to Comparison",
  },
  {
    title: "Arrears PDF",
    description:
      "Open Arrears page, choose buckets, then export visible arrear tables.",
    to: "/arrears",
    action: "Go to Arrears",
  },
  {
    title: "Rank List PDF",
    description:
      "Open Rankings, choose list size, generate rank list, then export PDF.",
    to: "/rankings",
    action: "Go to Rankings",
  },
];

export function ExportsPage() {
  const { department, semester, batch } =
    useOutletContext<LayoutOutletContext>();

  return (
    <section className="grid page-stack">
      <article className="panel">
        <div className="panel-head panel-head-stack">
          <h2>PDF Export Center</h2>
          <p className="hint">
            PDF export actions are now available directly in their respective
            tabs for a faster workflow.
          </p>
        </div>

        <p className="selection-pill">
          <span className="selection-chip">
            Department: <strong>{department}</strong>
          </span>
          <span className="selection-chip">
            Semester: <strong>{semester}</strong>
          </span>
          <span className="selection-chip">
            Batch: <strong>{batch || "Latest available"}</strong>
          </span>
        </p>

        <div className="grid grid-two">
          {exportCards.map((card) => (
            <section key={card.title} className="result-block export-card">
              <h3>{card.title}</h3>
              <p className="hint">{card.description}</p>
              <Link to={card.to} className="button-link">
                {card.action}
              </Link>
            </section>
          ))}
        </div>
      </article>
    </section>
  );
}
