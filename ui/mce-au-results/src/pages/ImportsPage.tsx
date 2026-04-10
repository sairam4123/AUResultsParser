import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  downloadSemesterJson,
  getStorageFolder,
  importResultsFile,
  setStorageFolder,
} from "../api/client";
import type { LayoutOutletContext } from "../layout/layoutContext";

export function ImportsPage() {
  const {
    department,
    semester,
    batch: selectedBatch,
  } = useOutletContext<LayoutOutletContext>();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [actionLoading, setActionLoading] = useState<
    "import" | "export" | "save-folder" | null
  >(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [storageFolder, setStorageFolderState] = useState("");
  const [regnoSlug, setRegnoSlug] = useState("");
  const [batch, setBatch] = useState("");

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
        <h2>Import Center</h2>
        <p className="hint">
          Import result PDFs and manage server JSON storage for Department{" "}
          {department}, Semester {semester}.
        </p>

        <section className="data-actions" aria-label="Import actions">
          <div className="input-wrap">
            <label htmlFor="resultsFile">Import Results PDF</label>
            <input
              id="resultsFile"
              type="file"
              accept=".pdf,application/pdf"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);
                setActionError("");
                setActionMessage("");
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
              : "Import and Save JSON"}
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
              : "Export Semester JSON"}
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
            <input
              id="batch"
              type="text"
              value={batch}
              placeholder="2025 or 25"
              onChange={(event) => setBatch(event.target.value)}
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
      </article>
    </section>
  );
}
