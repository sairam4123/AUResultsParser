import type {
  CompareResponse,
  DepartmentOption,
  DepartmentSummary,
  Meta,
  RankListResponse,
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

export const compareStudents = async (
  semester: number,
  department: string,
  regno1: string,
  regno2: string,
): Promise<CompareResponse["comparison"]> => {
  const payload = await fetchJson<CompareResponse>(
    `${BASE_API}/compare?semester=${semester}&department=${department}&regno1=${regno1.trim()}&regno2=${regno2.trim()}`,
  );
  return payload.comparison;
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
