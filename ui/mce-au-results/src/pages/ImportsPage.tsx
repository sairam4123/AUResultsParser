import { useEffect, useState } from "react";
import Select, { type SingleValue } from "react-select";
import { useOutletContext } from "react-router-dom";
import {
  downloadSemesterJson,
  getStorageFolder,
  importResultsFile,
  previewResultsFile,
  setStorageFolder,
} from "../api/client";
import type { LayoutOutletContext } from "../layout/layoutContext";
import type { ImportPreviewResponse } from "../types/api";
import { buildBatchSelectOptions } from "../utils/batchOptions";

type BatchOption = {
  value: string;
  label: string;
};

export function ImportsPage() {
  const {
    department,
    semester,
    batch: selectedBatch,
    availableSemesters,
    availableBatches,
  } = useOutletContext<LayoutOutletContext>();
  const menuPortalTarget =
    typeof window !== "undefined" ? document.body : undefined;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [actionLoading, setActionLoading] = useState<
    "import" | "export" | "save-folder" | null
  >(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [storageFolder, setStorageFolderState] = useState("");
  const [regnoSlug, setRegnoSlug] = useState("");
  const [batch, setBatch] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<ImportPreviewResponse | null>(
    null,
  );

  const importBatchOptions = buildBatchSelectOptions(availableBatches);
  const importBatchSelectOptions: BatchOption[] = importBatchOptions.map(
    (option) => ({
      value: option.value,
      label: option.label,
    }),
  );

  const selectedBatchOption =
    importBatchSelectOptions.find((option) => option.value === batch) ?? null;

  const semesterMismatch =
    previewData && previewData.semesters.length > 0
      ? !previewData.semesters.includes(semester)
      : false;

  const knownSemestersFromMeta = new Set(availableSemesters);

  useEffect(() => {
    let active = true;

    const loadStorageFolder = async () => {
      try {
        const folder = await getStorageFolder();
        if (active) {
          setStorageFolderState(folder);
        }
      } catch {
        // Non-blocking: import/export can still work with backend default path.
      }
    };

    void loadStorageFolder();

    return () => {
      active = false;
    };
  }, []);

  const onImportJson = async () => {
    if (!selectedFile) {
      setActionError("Choose a results PDF before importing.");
      setActionMessage("");
      return;
    }

    setActionLoading("import");
    setActionError("");
    setActionMessage("");
    try {
      const cleanedSlug = regnoSlug.trim();
      const cleanedBatch = batch.trim();

      if (cleanedSlug && cleanedBatch) {
        setActionError("Use either RegNo Slug or Batch, not both.");
        setActionLoading(null);
        return;
      }

      const payload = await importResultsFile(
        semester,
        department,
        selectedFile,
        {
          regnoSlug: cleanedSlug || undefined,
          batch: cleanedBatch || undefined,
        },
      );
      setActionMessage(
        `Imported ${payload.count} records from ${payload.source}. Saved to ${payload.output_path}.` +
          (payload.filter.effective_slug
            ? ` Filter used: ${payload.filter.effective_slug}.`
            : ""),
      );
      setSelectedFile(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to import result PDF.",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const onSaveStorageFolder = async () => {
    if (!storageFolder.trim()) {
      setActionError("Enter an absolute server folder path.");
      setActionMessage("");
      return;
    }

    setActionLoading("save-folder");
    setActionError("");
    setActionMessage("");

    try {
      const updated = await setStorageFolder(storageFolder.trim());
      setStorageFolderState(updated);
      setActionMessage(`Server JSON storage folder updated to: ${updated}`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update storage folder.",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const onExportJson = async () => {
    setActionLoading("export");
    setActionError("");
    setActionMessage("");
    try {
      await downloadSemesterJson(semester, department, selectedBatch);
      setActionMessage(
        `Downloaded semester JSON for ${department}, Semester ${semester}` +
          (selectedBatch.trim() ? `, Batch ${selectedBatch.trim()}.` : "."),
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to export semester JSON.",
      );
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <section className="grid page-stack">
      <article className="panel">
        <div className="panel-head panel-head-stack">
          <h2>Import Center</h2>
          <p className="hint">
            Import result PDFs, download JSON snapshots, and configure backend
            storage in one place.
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
            Active batch filter:{" "}
            <strong>{selectedBatch || "Latest available"}</strong>
          </span>
        </p>

        <h3>Import and Export Data</h3>
        <p className="hint">
          Use RegNo Slug or Batch to narrow import scope. Do not use both at the
          same time.
        </p>

        <section className="data-actions" aria-label="Import actions">
          <div className="input-wrap">
            <label htmlFor="resultsFile">Import Results PDF</label>
            <input
              id="resultsFile"
              type="file"
              accept=".pdf,application/pdf"
              onChange={async (event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);
                setActionError("");
                setActionMessage("");

                if (!file) {
                  setPreviewData(null);
                  return;
                }

                setPreviewLoading(true);
                try {
                  const preview = await previewResultsFile(file);
                  setPreviewData(preview);
                } catch (err) {
                  setPreviewData(null);
                  setActionError(
                    err instanceof Error
                      ? err.message
                      : "Failed to preview PDF structure.",
                  );
                } finally {
                  setPreviewLoading(false);
                }
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              void onImportJson();
            }}
            disabled={actionLoading !== null || !selectedFile}
          >
            {actionLoading === "import"
              ? "Importing..."
              : "Import PDF and Save JSON"}
          </button>

          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              void onExportJson();
            }}
            disabled={actionLoading !== null}
          >
            {actionLoading === "export"
              ? "Exporting..."
              : "Download Semester JSON"}
          </button>

          <div className="input-wrap data-actions-full">
            <label htmlFor="regnoSlug">RegNo Slug (Optional)</label>
            <input
              id="regnoSlug"
              type="text"
              value={regnoSlug}
              placeholder="812825205"
              onChange={(event) => setRegnoSlug(event.target.value)}
            />
          </div>

          <div className="input-wrap data-actions-full">
            <label htmlFor="batch">Batch (Optional)</label>
            <Select<BatchOption>
              inputId="batch"
              options={importBatchSelectOptions}
              value={selectedBatchOption}
              onChange={(option: SingleValue<BatchOption>) =>
                setBatch(option?.value ?? "")
              }
              isSearchable={false}
              isClearable
              placeholder="Latest available"
              menuPlacement="auto"
              menuPosition="fixed"
              menuPortalTarget={menuPortalTarget}
              className="rs-single"
              classNamePrefix="rs"
            />
          </div>

          <div className="input-wrap data-actions-full">
            <label htmlFor="storageFolder">Server JSON Storage Folder</label>
            <input
              id="storageFolder"
              type="text"
              value={storageFolder}
              placeholder="F:/Python Projects/AUResultsParser/results"
              onChange={(event) => setStorageFolderState(event.target.value)}
            />
            <p className="hint">
              Backend path must be absolute on the server machine.
            </p>
          </div>

          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              void onSaveStorageFolder();
            }}
            disabled={actionLoading !== null}
          >
            {actionLoading === "save-folder"
              ? "Saving..."
              : "Save Storage Folder"}
          </button>
        </section>

        {actionError ? <p className="error-banner">{actionError}</p> : null}
        {actionMessage ? (
          <p className="success-banner">{actionMessage}</p>
        ) : null}

        <section className="result-block">
          <h3>Detected PDF Structure</h3>
          {previewLoading ? (
            <p className="hint">Scanning PDF pages...</p>
          ) : null}
          {!previewLoading && !previewData ? (
            <p className="hint">
              Select a PDF to preview detected semesters and batches before
              import.
            </p>
          ) : null}

          {previewData ? (
            <div className="stack">
              <p className="hint">
                Source: <strong>{previewData.source}</strong>
              </p>

              {semesterMismatch ? (
                <p className="inline-error">
                  Current semester filter ({semester}) does not appear in this
                  PDF preview.
                </p>
              ) : null}

              <div className="selection-pill">
                {previewData.semesters.length > 0 ? (
                  previewData.semesters.map((value) => (
                    <span key={`det-sem-${value}`} className="selection-chip">
                      Semester <strong>{value}</strong>
                      {!knownSemestersFromMeta.has(value) ? "*" : ""}
                    </span>
                  ))
                ) : (
                  <span className="selection-chip">
                    <strong>No semester detected</strong>
                  </span>
                )}
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Semester</th>
                      <th>Detected Batches</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(previewData.batches_by_semester).map(
                      ([key, values]) => (
                        <tr key={`batch-sem-${key}`}>
                          <td>{key}</td>
                          <td>{values.length > 0 ? values.join(", ") : "-"}</td>
                        </tr>
                      ),
                    )}
                    {Object.keys(previewData.batches_by_semester).length ===
                    0 ? (
                      <tr>
                        <td colSpan={2}>No semester-batch mapping detected.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Semester</th>
                      <th>Batch</th>
                      <th>Pages</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.pages_by_semester_batch.map((item) => (
                      <tr key={`page-map-${item.semester}-${item.batch}`}>
                        <td>{item.semester}</td>
                        <td>{item.batch}</td>
                        <td>{item.pages.join(", ")}</td>
                      </tr>
                    ))}
                    {previewData.pages_by_semester_batch.length === 0 ? (
                      <tr>
                        <td colSpan={3}>No page-level mapping detected.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      </article>
    </section>
  );
}
