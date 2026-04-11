import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { getArrearStudents } from "../api/client";
import { StudentNameLink } from "../components/StudentNameLink";
import type { LayoutOutletContext } from "../layout/layoutContext";
import type { ArrearStudent } from "../types/api";
import { exportMultiPageTablesPdf } from "../utils/pdf";

type ArrearTab = "1" | "2" | "3+" | "3" | "4" | "5+";

type CountSnapshot = {
  "1": number;
  "2": number;
  "3+": number;
  "4": number;
  "5": number;
};

const defaultTabs: ArrearTab[] = ["1", "2", "3+"];
const splitTabs: ArrearTab[] = ["1", "2", "3", "4", "5+"];

const tabLabel: Record<ArrearTab, string> = {
  "1": "1 Arrear",
  "2": "2 Arrears",
  "3+": "3+ Arrears",
  "3": "3 Arrears",
  "4": "4 Arrears",
  "5+": "5+ Arrears",
};

export function ArrearsPage() {
  const { department, semester, batch } =
    useOutletContext<LayoutOutletContext>();

  const [arrearCounts, setArrearCounts] = useState<CountSnapshot>({
    "1": 0,
    "2": 0,
    "3+": 0,
    "4": 0,
    "5": 0,
  });
  const [splitThreePlus, setSplitThreePlus] = useState(false);
  const [selectedTabs, setSelectedTabs] = useState<ArrearTab[]>(defaultTabs);
  const [rowsByTab, setRowsByTab] = useState<
    Record<ArrearTab, ArrearStudent[]>
  >({
    "1": [],
    "2": [],
    "3+": [],
    "3": [],
    "4": [],
    "5+": [],
  });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const longPressTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!department || !semester) {
      return;
    }

    let active = true;

    const loadCounts = async () => {
      try {
        const payload = await getArrearStudents(semester, department, {
          batch,
        });
        if (active) {
          setArrearCounts(payload.counts);
        }
      } catch {
        if (active) {
          setArrearCounts({ "1": 0, "2": 0, "3+": 0, "4": 0, "5": 0 });
        }
      }
    };

    void loadCounts();

    return () => {
      active = false;
    };
  }, [department, semester, batch]);

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
            if (tab === "1" || tab === "2" || tab === "3+") {
              const payload = await getArrearStudents(semester, department, {
                bucket: tab,
                batch,
              });
              return [tab, payload.students] as const;
            }

            if (tab === "3" || tab === "4") {
              const payload = await getArrearStudents(semester, department, {
                exactCount: Number(tab),
                batch,
              });
              return [tab, payload.students] as const;
            }

            const payload = await getArrearStudents(semester, department, {
              bucket: "3+",
              batch,
            });
            return [
              tab,
              payload.students.filter((item) => item.arrears >= 5),
            ] as const;
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

    void loadRows();

    return () => {
      active = false;
    };
  }, [department, semester, batch, selectedTabs]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current !== null) {
        window.clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const activateSplitView = () => {
    setSplitThreePlus(true);
    setSelectedTabs((current) => {
      const expanded = current.flatMap((tab) =>
        tab === "3+" ? (["3", "4", "5+"] as ArrearTab[]) : tab,
      );
      return Array.from(new Set(expanded));
    });
  };

  const startThreePlusPress = () => {
    if (splitThreePlus) {
      return;
    }

    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
    }

    longPressTimer.current = window.setTimeout(() => {
      activateSplitView();
      longPressTimer.current = null;
    }, 450);
  };

  const stopThreePlusPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const toggleTab = (tab: ArrearTab) => {
    setSelectedTabs((current) => {
      if (current.includes(tab)) {
        return current.filter((item) => item !== tab);
      }
      return [...current, tab];
    });
  };

  const tabs = splitThreePlus ? splitTabs : defaultTabs;

  const selectedForRender = useMemo(
    () => tabs.filter((tab) => selectedTabs.includes(tab)),
    [tabs, selectedTabs],
  );

  const getTabCount = (tab: ArrearTab) => {
    if (tab === "1" || tab === "2" || tab === "3+") {
      return arrearCounts[tab];
    }

    return rowsByTab[tab].length;
  };

  const onExportArrearsPdf = async () => {
    if (selectedForRender.length === 0) {
      setError("Select at least one arrear bucket before exporting.");
      return;
    }

    setExporting(true);
    setError("");

    try {
      const tables = selectedForRender.map((tab) => ({
        title: `Arrear Explorer - ${tabLabel[tab]}`,
        subtitle: `${department} Semester ${semester}`,
        headers: ["Reg No", "Name", "Arrears"],
        rows: rowsByTab[tab].map((item) => [
          item.regno,
          item.name,
          String(item.arrears),
        ]),
      }));

      await exportMultiPageTablesPdf(
        `arrears-sem-${semester}-${department}.pdf`,
        tables,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Arrears export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="grid page-stack">
      <article className="panel">
        <div className="panel-head panel-head-stack">
          <h2>Arrear Explorer</h2>
          <p className="hint">
            Toggle buckets to inspect matching students. Double-click or
            long-press 3+ to split into 3, 4, and 5+ buckets.
          </p>
        </div>

        <div className="arrear-tab-grid">
          {tabs.map((tab) => {
            const isThreePlusBase = tab === "3+" && !splitThreePlus;
            return (
              <button
                key={tab}
                type="button"
                className={
                  selectedTabs.includes(tab) ? "tab-chip active" : "tab-chip"
                }
                onClick={() => toggleTab(tab)}
                onDoubleClick={isThreePlusBase ? activateSplitView : undefined}
                onMouseDown={isThreePlusBase ? startThreePlusPress : undefined}
                onMouseUp={isThreePlusBase ? stopThreePlusPress : undefined}
                onMouseLeave={isThreePlusBase ? stopThreePlusPress : undefined}
                onTouchStart={isThreePlusBase ? startThreePlusPress : undefined}
                onTouchEnd={isThreePlusBase ? stopThreePlusPress : undefined}
              >
                {tabLabel[tab]} ({getTabCount(tab)})
              </button>
            );
          })}
        </div>

        <div className="inline-form">
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              void onExportArrearsPdf();
            }}
            disabled={exporting || loading || selectedForRender.length === 0}
          >
            {exporting ? "Exporting..." : "Export Visible Arrear PDF"}
          </button>
        </div>

        {loading ? <p>Loading arrear lists...</p> : null}
        {error ? <p className="inline-error">{error}</p> : null}

        {selectedForRender.length === 0 ? (
          <p className="hint">
            No bucket selected. Select at least one arrear bucket to view data.
          </p>
        ) : null}

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
                      <td>
                        <StudentNameLink regno={item.regno} name={item.name} />
                      </td>
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
