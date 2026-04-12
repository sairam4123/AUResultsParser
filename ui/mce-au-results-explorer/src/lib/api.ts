export type DepartmentOption = {
  name: string;
  code: number;
};

export type MetaResponse = {
  departments: DepartmentOption[];
  semesters: number[];
  batches: string[];
};

export type SummaryResponse = {
  semester: number;
  department_code: number;
  source: string;
  summary: {
    appeared: number;
    passed: number;
    failed: number;
    pass_percentage: number;
    one_arrear: number;
    two_arrears: number;
    "three+_arrears": number;
  };
};

export type RankListResponse = {
  items: {
    rank: number;
    regno: string;
    name: string;
    sgpa: number;
  }[];
};

export type ArrearsResponse = {
  counts: {
    "1": number;
    "2": number;
    "3+": number;
    "4": number;
    "5": number;
  };
  students: {
    regno: string;
    name: string;
    arrears: number;
  }[];
};

export type StudentResponse = {
  student: {
    regno: string;
    name: string;
    sgpa: number;
    rank: number | null;
    arrears: number;
    subjects: {
      code: string;
      name: string;
      grade: string;
      status: string;
    }[];
  };
};

export type StudentDirectoryItem = {
  regno: string;
  name: string;
};

export type StudentsDirectoryResponse = {
  semester: number;
  department_code: number;
  source: string;
  count: number;
  items: StudentDirectoryItem[];
};

export type CompareResponse = {
  comparison: {
    headers: string[];
    table: string[][];
    footer: string[];
  };
};

export type StudentAuditResponse = {
  semester: number;
  department_code: number;
  batch: string;
  source: string;
  regno: string;
  name: string;
  sgpa: number | null;
  effective_totals: {
    credits: number;
    grade_points: number;
    sgpa: number | null;
    arrears: number;
  };
  effective_subjects: {
    code: string;
    name: string;
    grade: string;
    status: string;
  }[];
  events: {
    exam_id: number;
    exam_name: string;
    result_date: string;
    subject_code: string;
    subject_name: string;
    sem_name: string;
    state: string;
    grade: string;
    recency_rank: number;
  }[];
};

export type SubjectSummaryResponse = {
  subjects: {
    code: string;
    name: string;
    appeared: number;
    passed: number;
    failed: number;
    pass_percentage: number;
  }[];
};

export type CgpaClassSummary = {
  students_considered: number;
  average_cgpa: number;
  total_arrears: number;
  students_without_arrears: number;
};

export type CgpaClassRow = {
  regno: string;
  name: string;
  semester_sgpa: Record<string, number | null>;
  cgpa: number | null;
  arrears: number;
  credits: number;
};

export type CgpaClassResponse = {
  department_code: number;
  semesters: number[];
  sources: Record<string, string>;
  summary: CgpaClassSummary;
  rows: CgpaClassRow[];
};

export type CgpaBreakdownSubjectRow = {
  code: string;
  name: string;
  grade: string;
  credit: number;
  gp: number | null;
  credit_x_gp: number;
  included: boolean;
};

export type CgpaBreakdownSemester = {
  semester: number;
  subjects: CgpaBreakdownSubjectRow[];
  totals: {
    credits: number;
    grade_points: number;
    sgpa: number | null;
    arrears: number;
  };
};

export type CgpaBreakdownResponse = {
  department_code: number;
  requested_semesters: number[];
  sources: Record<string, string>;
  regno: string;
  name: string;
  overall: {
    credits: number;
    grade_points: number;
    cgpa: number | null;
    arrears: number;
  };
  semesters: CgpaBreakdownSemester[];
};

export type CgpaCompareRow = {
  metric: string;
  student1_value: number | null;
  student2_value: number | null;
  diff: number | null;
  student1_arrears: number;
  student2_arrears: number;
  student1_credits: number;
  student2_credits: number;
};

export type CgpaCompareSubjectRow = {
  code: string;
  name: string;
  credit: number;
  student1_grade: string;
  student2_grade: string;
  student1_credit_x_gp: number;
  student2_credit_x_gp: number;
  diff: number;
};

export type CgpaCompareSubjectDetails = {
  semester: number;
  rows: CgpaCompareSubjectRow[];
};

export type CgpaCompareResponse = {
  department_code: number;
  semesters: number[];
  sources: Record<string, string>;
  student1: {
    regno: string;
    name: string;
  };
  student2: {
    regno: string;
    name: string;
  };
  rows: CgpaCompareRow[];
  subject_details: CgpaCompareSubjectDetails[];
};

const normalizeApiBase = (baseUrl: string): string => {
  const normalized = baseUrl.trim().replace(/\/+$/, "");

  if (normalized.endsWith("/api/v2")) {
    return normalized;
  }

  if (normalized.endsWith("/api/v1")) {
    return `${normalized.slice(0, -3)}v2`;
  }

  if (normalized.endsWith("/api")) {
    return `${normalized}/v2`;
  }

  return `${normalized}/api/v2`;
};

const API_BASE = normalizeApiBase(
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "http://127.0.0.1:3000/api/v2",
);

const getJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`);
  const payload = await response.json();

  if (!response.ok) {
    const detail =
      typeof payload?.detail === "string" ? payload.detail : "Request failed";
    throw new Error(detail);
  }

  return payload as T;
};

const withBatch = (search: URLSearchParams, batch: string | null) => {
  if (batch && batch.trim()) {
    search.set("batch", batch.trim());
  }
};

const buildCgpaSearch = (params: {
  semesters: string;
  department: string;
  batch: string | null;
}) => {
  const search = new URLSearchParams({
    semesters: params.semesters,
    department: params.department,
  });
  withBatch(search, params.batch);
  return search;
};

export const api = {
  getMeta: () => getJson<MetaResponse>("/meta"),

  getSummary: (semester: number, department: string, batch: string | null) => {
    const search = new URLSearchParams({
      semester: String(semester),
      department,
    });
    withBatch(search, batch);
    return getJson<SummaryResponse>(`/summary?${search.toString()}`);
  },

  getRankList: (
    semester: number,
    department: string,
    batch: string | null,
    topK: number,
  ) => {
    const search = new URLSearchParams({
      semester: String(semester),
      department,
      top_k: String(topK),
    });
    withBatch(search, batch);
    return getJson<RankListResponse>(`/rank-list?${search.toString()}`);
  },

  getArrears: (
    semester: number,
    department: string,
    batch: string | null,
    options?: {
      bucket?: "1" | "2" | "3+";
      exactCount?: number;
    },
  ) => {
    const search = new URLSearchParams({
      semester: String(semester),
      department,
    });
    withBatch(search, batch);

    if (options?.bucket) {
      search.set("bucket", options.bucket);
    }
    if (typeof options?.exactCount === "number") {
      search.set("exact_count", String(options.exactCount));
    }

    return getJson<ArrearsResponse>(`/arrears?${search.toString()}`);
  },

  getStudent: (
    semester: number,
    department: string,
    batch: string | null,
    regno: string,
  ) => {
    const search = new URLSearchParams({
      semester: String(semester),
      department,
      regno,
    });
    withBatch(search, batch);
    return getJson<StudentResponse>(`/student?${search.toString()}`);
  },

  getStudentAudit: (
    semester: number,
    department: string,
    batch: string | null,
    regno: string,
  ) => {
    const search = new URLSearchParams({
      semester: String(semester),
      department,
      regno,
    });
    withBatch(search, batch);
    return getJson<StudentAuditResponse>(`/student-audit?${search.toString()}`);
  },

  getStudentsDirectory: (
    semester: number,
    department: string,
    batch: string | null,
    options?: {
      q?: string;
      limit?: number;
    },
  ) => {
    const search = new URLSearchParams({
      semester: String(semester),
      department,
    });
    withBatch(search, batch);
    if (options?.q?.trim()) {
      search.set("q", options.q.trim());
    }
    if (typeof options?.limit === "number") {
      search.set("limit", String(options.limit));
    }
    return getJson<StudentsDirectoryResponse>(`/students?${search.toString()}`);
  },

  getCompare: (
    semester: number,
    department: string,
    batch: string | null,
    regno1: string,
    regno2: string,
  ) => {
    const search = new URLSearchParams({
      semester: String(semester),
      department,
      regno1: regno1.trim(),
      regno2: regno2.trim(),
    });
    withBatch(search, batch);
    return getJson<CompareResponse>(`/compare?${search.toString()}`);
  },

  getSubjectSummary: (
    semester: number,
    department: string,
    batch: string | null,
  ) => {
    const search = new URLSearchParams({
      semester: String(semester),
      department,
    });
    withBatch(search, batch);
    return getJson<SubjectSummaryResponse>(
      `/subject-summary?${search.toString()}`,
    );
  },

  getCgpaClass: (params: {
    semesters: string;
    department: string;
    batch: string | null;
    regno?: string;
    sortBy?: "cgpa" | "arrears" | "regno";
    top?: number;
  }) => {
    const search = buildCgpaSearch(params);
    if (params.regno?.trim()) {
      search.set("regno", params.regno.trim());
    }
    if (params.sortBy) {
      search.set("sort_by", params.sortBy);
    }
    if (typeof params.top === "number" && Number.isFinite(params.top)) {
      search.set("top", String(params.top));
    }
    return getJson<CgpaClassResponse>(`/cgpa/class?${search.toString()}`);
  },

  getCgpaBreakdown: (params: {
    semesters: string;
    department: string;
    batch: string | null;
    regno: string;
  }) => {
    const search = buildCgpaSearch(params);
    search.set("regno", params.regno.trim());
    return getJson<CgpaBreakdownResponse>(
      `/cgpa/breakdown?${search.toString()}`,
    );
  },

  getCgpaCompare: (params: {
    semesters: string;
    department: string;
    batch: string | null;
    regno1: string;
    regno2: string;
    subjectDetails?: boolean;
  }) => {
    const search = buildCgpaSearch(params);
    search.set("regno1", params.regno1.trim());
    search.set("regno2", params.regno2.trim());
    if (params.subjectDetails) {
      search.set("subject_details", "true");
    }
    return getJson<CgpaCompareResponse>(`/cgpa/compare?${search.toString()}`);
  },
};
