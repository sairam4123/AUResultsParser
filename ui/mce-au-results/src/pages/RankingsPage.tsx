import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useOutletContext } from "react-router-dom";
import { getRankList } from "../api/client";
import { StudentNameLink } from "../components/StudentNameLink";
import type { LayoutOutletContext } from "../layout/layoutContext";
import type { RankListItem } from "../types/api";
import { exportSingleTablePdf } from "../utils/pdf";

export function RankingsPage() {
  const { department, semester, batch } =
    useOutletContext<LayoutOutletContext>();

  const [rankList, setRankList] = useState<RankListItem[]>([]);
  const [listSize, setListSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const loadRankList = useCallback(
    async (limit: number) => {
      setLoading(true);
      setError("");

      try {
        const payload = await getRankList(semester, department, limit, batch);
        setRankList(payload);
      } catch (err) {
        setRankList([]);
        setError(
          err instanceof Error ? err.message : "Failed to load rank list",
        );
      } finally {
        setLoading(false);
      }
    },
    [department, semester, batch],
  );

  useEffect(() => {
    setListSize(10);
    loadRankList(10).catch(() => undefined);
  }, [loadRankList]);

  const onGetRankList = async (event: FormEvent) => {
    event.preventDefault();
    await loadRankList(listSize);
  };

  const onExportRankingsPdf = async () => {
    if (rankList.length === 0) {
      setError("Generate a rank list before exporting PDF.");
      return;
    }

    setExporting(true);
    setError("");
    try {
      await exportSingleTablePdf(`rankings-sem-${semester}-${department}.pdf`, {
        title: "Rank List",
        subtitle: `${department} Semester ${semester} | ${rankList.length} students`,
        headers: ["Rank", "Reg No", "Name", "SGPA"],
        rows: rankList.map((row) => [
          String(row.rank),
          row.regno,
          row.name,
          row.sgpa.toFixed(2),
        ]),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rankings export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="grid page-stack">
      <article className="panel">
        <div className="panel-head panel-head-stack">
          <h2>Rank List</h2>
          <p className="hint">
            Start with 10 records, then adjust the list size as needed.
          </p>
        </div>
        <form onSubmit={onGetRankList} className="inline-form">
          <div className="input-wrap compact">
            <label htmlFor="rankListSize">List Size</label>
            <input
              id="rankListSize"
              type="number"
              min={1}
              max={200}
              value={listSize}
              onChange={(event) => setListSize(Number(event.target.value))}
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? "Generating..." : "Generate Rank List"}
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              void onExportRankingsPdf();
            }}
            disabled={exporting || loading || rankList.length === 0}
          >
            {exporting ? "Exporting..." : "Export Rank List PDF"}
          </button>
        </form>

        {error ? <p className="inline-error">{error}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Reg No</th>
                <th>Name</th>
                <th>SGPA</th>
              </tr>
            </thead>
            <tbody>
              {rankList.map((row) => (
                <tr key={`${row.rank}-${row.regno}`}>
                  <td>{row.rank}</td>
                  <td>{row.regno}</td>
                  <td>
                    <StudentNameLink regno={row.regno} name={row.name} />
                  </td>
                  <td>{row.sgpa.toFixed(2)}</td>
                </tr>
              ))}
              {rankList.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    No rank list loaded. Choose list size and generate the list.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
