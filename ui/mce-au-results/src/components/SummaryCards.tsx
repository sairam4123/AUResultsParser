import type { Summary } from "../types/api";

type SummaryCardsProps = {
  summary: Summary;
};

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="stats">
      <div className="stat-card">
        <span>Appeared</span>
        <strong>{summary.appeared}</strong>
      </div>
      <div className="stat-card">
        <span>Passed</span>
        <strong>{summary.passed}</strong>
      </div>
      <div className="stat-card">
        <span>Failed</span>
        <strong>{summary.failed}</strong>
      </div>
      <div className="stat-card">
        <span>Pass %</span>
        <strong>{summary.pass_percentage.toFixed(2)}%</strong>
      </div>
      <div className="stat-card">
        <span>1 Arrear</span>
        <strong>{summary.one_arrear}</strong>
      </div>
      <div className="stat-card">
        <span>2 Arrears</span>
        <strong>{summary.two_arrears}</strong>
      </div>
      <div className="stat-card">
        <span>3+ Arrears</span>
        <strong>{summary["three+_arrears"]}</strong>
      </div>
    </div>
  );
}
