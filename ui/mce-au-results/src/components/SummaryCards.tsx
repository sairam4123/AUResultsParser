import type { Summary } from "../types/api";

type SummaryCardsProps = {
  summary: Summary;
};

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="summary-strip">
      <div className="metric-card">
        <span>Appeared</span>
        <strong>{summary.appeared}</strong>
      </div>
      <div className="metric-card">
        <span>Passed</span>
        <strong>{summary.passed}</strong>
      </div>
      <div className="metric-card">
        <span>Failed</span>
        <strong>{summary.failed}</strong>
      </div>
      <div className="metric-card metric-pass">
        <span>Pass %</span>
        <strong>{summary.pass_percentage.toFixed(2)}%</strong>
      </div>
      <div className="metric-card">
        <span>1 Arrear</span>
        <strong>{summary.one_arrear}</strong>
      </div>
      <div className="metric-card">
        <span>2 Arrears</span>
        <strong>{summary.two_arrears}</strong>
      </div>
      <div className="metric-card">
        <span>3+ Arrears</span>
        <strong>{summary["three+_arrears"]}</strong>
      </div>
    </div>
  );
}
