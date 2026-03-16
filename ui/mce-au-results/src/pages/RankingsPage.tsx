import { useState } from "react";
import type { FormEvent } from "react";
import { useOutletContext } from "react-router-dom";
import { getRankList } from "../api/client";
import type { LayoutOutletContext } from "../layout/layoutContext";
import type { RankListItem } from "../types/api";

export function RankingsPage() {
  const { department, semester } = useOutletContext<LayoutOutletContext>();

  const [rankList, setRankList] = useState<RankListItem[]>([]);
  const [topK, setTopK] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onGetRankList = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = await getRankList(semester, department, topK);
      setRankList(payload);
    } catch (err) {
      setRankList([]);
      setError(err instanceof Error ? err.message : "Failed to load rank list");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="grid page-stack">
      <article className="panel">
        <h2>Rank List</h2>
        <form onSubmit={onGetRankList} className="inline-form">
          <div className="input-wrap compact">
            <label htmlFor="topK">Top K</label>
            <input
              id="topK"
              type="number"
              min={1}
              max={200}
              value={topK}
              onChange={(event) => setTopK(Number(event.target.value))}
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? "Generating..." : "Generate"}
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
                  <td>{row.name}</td>
                  <td>{row.sgpa.toFixed(2)}</td>
                </tr>
              ))}
              {rankList.length === 0 ? (
                <tr>
                  <td colSpan={4}>No rank list loaded yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
