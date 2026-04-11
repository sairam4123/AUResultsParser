import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getMeta } from "./api/client";
import { AppLayout } from "./layout/AppLayout";
import { ArrearsPage } from "./pages/ArrearsPage";
import { ComparisonPage } from "./pages/ComparisonPage";
import { CgpaPage } from "./pages/CgpaPage";
import { ExportsPage } from "./pages/ExportsPage";
import { ImportsPage } from "./pages/ImportsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { RankingsPage } from "./pages/RankingsPage";
import { StudentProfilePage } from "./pages/StudentProfilePage";
import { StudentsPage } from "./pages/StudentsPage";
import type { Meta } from "./types/api";
import "./App.css";

function App() {
  const [meta, setMeta] = useState<Meta>({
    departments: [],
    semesters: [],
    batches: [],
  });
  const [department, setDepartment] = useState("IT");
  const [semester, setSemester] = useState(5);
  const [batch, setBatch] = useState("");
  const [metaLoading, setMetaLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadMetadata = async () => {
      setMetaLoading(true);
      setError("");

      try {
        const payload = await getMeta();
        if (!active) {
          return;
        }

        setMeta(payload);
        if (payload.departments.length > 0) {
          setDepartment((current) => {
            const exists = payload.departments.some(
              (dep) => dep.name === current,
            );
            return exists ? current : payload.departments[0].name;
          });
        }

        if (payload.semesters.length > 0) {
          setSemester((current) =>
            payload.semesters.includes(current)
              ? current
              : payload.semesters[0],
          );
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Failed to load metadata",
          );
        }
      } finally {
        if (active) {
          setMetaLoading(false);
        }
      }
    };

    loadMetadata().catch(() => {
      if (active) {
        setError("Failed to load metadata");
        setMetaLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <AppLayout
              departments={meta.departments}
              semesters={meta.semesters}
              department={department}
              semester={semester}
              batch={batch}
              availableBatches={meta.batches}
              onDepartmentChange={setDepartment}
              onSemesterChange={setSemester}
              onBatchChange={setBatch}
              error={error}
              metaLoading={metaLoading}
            />
          }
        >
          <Route path="/" element={<OverviewPage />} />
          <Route path="/arrears" element={<ArrearsPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/student/:regno" element={<StudentProfilePage />} />
          <Route path="/cgpa" element={<CgpaPage />} />
          <Route path="/comparison" element={<ComparisonPage />} />
          <Route path="/rankings" element={<RankingsPage />} />
          <Route path="/exports" element={<ExportsPage />} />
          <Route path="/imports" element={<ImportsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
