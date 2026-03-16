import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { getArrearStudents } from "../api/client";
import type { LayoutOutletContext } from "../layout/layoutContext";
import type { ArrearStudent } from "../types/api";

type ArrearTab = "1" | "2" | "3+" | "4" | "5";

const allTabs: ArrearTab[] = ["1", "2", "3+", "4", "5"];

const tabLabel: Record<ArrearTab, string> = {
  "1": "1 Arrear",
  "2": "2 Arrears",
  "3+": "3+ Arrears",
  "4": "Exactly 4",
  "5": "Exactly 5",
};

export function ArrearsPage() {
  const { department, semester } = useOutletContext<LayoutOutletContext>();

  const [arrearCounts, setArrearCounts] = useState({
    "1": 0,
    "2": 0,
    "3+": 0,
    "4": 0,
    "5": 0,
  });
  const [selectedTabs, setSelectedTabs] = useState<ArrearTab[]>([
    "1",
    "2",
    "3+",
  ]);
  const [rowsByTab, setRowsByTab] = useState<
    Record<ArrearTab, ArrearStudent[]>
  >({
    "1": [],
    "2": [],
    "3+": [],
    "4": [],
    "5": [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!department || !semester) {
      return;
    }

    let active = true;

    const loadCounts = async () => {
      try {
        const payload = await getArrearStudents(semester, department, {});
        if (active) {
          setArrearCounts(payload.counts);
        }
      } catch {
        if (active) {
          setArrearCounts({ "1": 0, "2": 0, "3+": 0, "4": 0, "5": 0 });
        }
      }
    };

    loadCounts().catch(() => undefined);

    return () => {
      active = false;
    };
  }, [department, semester]);

  useEffect(() => {
    if (!department || !semester || selectedTabs.length === 0) {
      return;
    }

    let active = true;

    const loadRows = async () => {
      setLoading(true);
      setError("");

      try {
        const tabEntries = await Promise.all(
          selectedTabs.map(async (tab) => {
            const payload =
              tab === "1" || tab === "2" || tab === "3+"
                ? await getArrearStudents(semester, department, { bucket: tab })
                : await getArrearStudents(semester, department, {
                    exactCount: Number(tab),
                  });

            return [tab, payload.students] as const;
          }),
        );

        if (!active) {
          return;
        }

        setRowsByTab((previous) => {
          const next = { ...previous };
          tabEntries.forEach(([tab, rows]) => {
            next[tab] = rows;
          });
          return next;
        });
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Failed to load arrear list.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadRows().catch(() => {
      if (active) {
        setError("Failed to load arrear list.");
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [department, semester, selectedTabs]);

  const toggleTab = (tab: ArrearTab) => {
    setSelectedTabs((current) => {
      if (current.includes(tab)) {
        return current.filter((item) => item !== tab);
      }
      return [...current, tab];
    });
  };

  const selectedForRender = useMemo(
    () => allTabs.filter((tab) => selectedTabs.includes(tab)),
    [selectedTabs],
  );

  return (
    <section className="grid page-stack">
      <article className="panel">
        <div className="panel-head">
          <h2>Arrear Explorer</h2>
        </div>

        <p className="hint">
          Select one or more arrear counts. Export creates one PDF page per
          selected count.
        </p>

        <div className="arrear-tab-grid">
          {allTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={
                selectedTabs.includes(tab) ? "tab-chip active" : "tab-chip"
              }
              onClick={() => toggleTab(tab)}
            >
              {tabLabel[tab]} ({arrearCounts[tab]})
            </button>
          ))}
        </div>

        {loading ? <p>Loading arrear lists...</p> : null}
        {error ? <p className="inline-error">{error}</p> : null}

        {selectedForRender.map((tab) => (
          <section key={tab} className="result-block">
            <h3>{tabLabel[tab]}</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Reg No</th>
                    <th>Name</th>
                    <th>Arrears</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsByTab[tab].map((item) => (
                    <tr key={`${tab}-${item.regno}`}>
                      <td>{item.regno}</td>
                      <td>{item.name}</td>
                      <td>{item.arrears}</td>
                    </tr>
                  ))}
                  {rowsByTab[tab].length === 0 && !loading ? (
                    <tr>
                      <td colSpan={3}>
                        No matching students for this arrear filter.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </article>
    </section>
  );
}
