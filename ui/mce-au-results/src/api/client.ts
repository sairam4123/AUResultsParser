import type {
  ArrearsResponse,
  DepartmentOption,
  DepartmentSummary,
  ImportResultsResponse,
  Meta,
  RankListResponse,
  StorageFolderResponse,
  StudentDirectoryItem,
  StudentsDirectoryResponse,
  StudentResponse,
  SummaryResponse,
} from "../types/api";

const BASE_API =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
  "http://127.0.0.1:3000/api";

const fetchJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(path);
  const payload = await response.json();

  if (!response.ok) {
    const detail =
      typeof payload?.detail === "string" ? payload.detail : "Request failed";
    throw new Error(detail);
  }

  return payload as T;
};

export const getMeta = async (): Promise<Meta> => {
  return fetchJson<Meta>(`${BASE_API}/meta`);
};

export const getSummary = async (
  semester: number,
  department: string,
): Promise<SummaryResponse["summary"]> => {
  const payload = await fetchJson<SummaryResponse>(
    `${BASE_API}/summary?semester=${semester}&department=${department}`,
  );
  return payload.summary;
};

export const getStudent = async (
  semester: number,
  department: string,
  regno: string,
): Promise<StudentResponse["student"]> => {
  const payload = await fetchJson<StudentResponse>(
    `${BASE_API}/student?semester=${semester}&department=${department}&regno=${regno.trim()}`,
  );
  return payload.student;
};

export const getRankList = async (
  semester: number,
  department: string,
  topK: number,
): Promise<RankListResponse["items"]> => {
  const payload = await fetchJson<RankListResponse>(
    `${BASE_API}/rank-list?semester=${semester}&department=${department}&top_k=${topK}`,
  );
  return payload.items;
};

export const getStudentsDirectory = async (
  semester: number,
  department: string,
  query?: string,
): Promise<StudentDirectoryItem[]> => {
  const params = new URLSearchParams({
    semester: String(semester),
    department,
  });

  if (query && query.trim()) {
    params.set("q", query.trim());
  }

  const payload = await fetchJson<StudentsDirectoryResponse>(
    `${BASE_API}/students?${params.toString()}`,
  );
  return payload.items;
};

export const getDepartmentSummaries = async (
  semester: number,
  departments: DepartmentOption[],
): Promise<DepartmentSummary[]> => {
  const requests = departments.map(async (department) => {
    const summary = await getSummary(semester, department.name);
    return {
      name: department.name,
      code: department.code,
      summary,
    };
  });

  const settled = await Promise.allSettled(requests);

  return settled
    .filter(
      (item): item is PromiseFulfilledResult<DepartmentSummary> =>
        item.status === "fulfilled",
    )
    .map((item) => item.value)
    .sort((a, b) => b.summary.pass_percentage - a.summary.pass_percentage);
};

export const getArrearStudents = async (
  semester: number,
  department: string,
  options: { bucket?: "1" | "2" | "3+"; exactCount?: number },
): Promise<ArrearsResponse> => {
  const query = new URLSearchParams({
    semester: String(semester),
    department,
  });

  if (options.bucket) {
    query.set("bucket", options.bucket);
  }
  if (typeof options.exactCount === "number") {
    query.set("exact_count", String(options.exactCount));
  }

  return fetchJson<ArrearsResponse>(`${BASE_API}/arrears?${query.toString()}`);
};

export const importResultsFile = async (
  semester: number,
  department: string,
  file: File,
  options?: { regnoSlug?: string; batch?: string },
): Promise<ImportResultsResponse> => {
  const formData = new FormData();
  formData.set("semester", String(semester));
  formData.set("department", department);
  formData.set("results_file", file);
  if (options?.regnoSlug?.trim()) {
    formData.set("regno_slug", options.regnoSlug.trim());
  }
  if (options?.batch?.trim()) {
    formData.set("batch", options.batch.trim());
  }

  const response = await fetch(`${BASE_API}/import-results`, {
    method: "POST",
    body: formData,
  });

  const payload = await response.json();
  if (!response.ok) {
    const detail =
      typeof payload?.detail === "string" ? payload.detail : "Request failed";
    throw new Error(detail);
  }

  return payload as ImportResultsResponse;
};

export const downloadSemesterJson = async (
  semester: number,
  department: string,
): Promise<void> => {
  const query = new URLSearchParams({
    semester: String(semester),
    department,
  });

  const response = await fetch(`${BASE_API}/export-json?${query.toString()}`);
  if (!response.ok) {
    let detail = "Request failed";
    try {
      const payload = await response.json();
      if (typeof payload?.detail === "string") {
        detail = payload.detail;
      }
    } catch {
      // Ignore JSON parsing errors and use default message.
    }
    throw new Error(detail);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition");
  const fileNameMatch = contentDisposition?.match(/filename="?([^";]+)"?/i);
  const fileName =
    fileNameMatch?.[1] ?? `semester_${semester}_results_${department}.json`;

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};

export const getStorageFolder = async (): Promise<string> => {
  const payload = await fetchJson<StorageFolderResponse>(
    `${BASE_API}/storage-folder`,
  );
  return payload.folder;
};

export const setStorageFolder = async (folder: string): Promise<string> => {
  const response = await fetch(`${BASE_API}/storage-folder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ folder }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const detail =
      typeof payload?.detail === "string" ? payload.detail : "Request failed";
    throw new Error(detail);
  }

  return (payload as StorageFolderResponse).folder;
};
