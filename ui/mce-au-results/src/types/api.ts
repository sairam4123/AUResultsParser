export type DepartmentOption = {
  name: string;
  code: number;
};

export type Meta = {
  departments: DepartmentOption[];
  semesters: number[];
  batches: string[];
};

export type Summary = {
  appeared: number;
  passed: number;
  failed: number;
  pass_percentage: number;
  one_arrear: number;
  two_arrears: number;
  "three+_arrears": number;
};

export type SummaryResponse = {
  summary: Summary;
};

export type Student = {
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

export type StudentResponse = {
  student: Student;
};

export type StudentDirectoryItem = {
  regno: string;
  name: string;
};

export type StudentsDirectoryResponse = {
  items: StudentDirectoryItem[];
};

export type RankListItem = {
  rank: number;
  regno: string;
  name: string;
  sgpa: number;
};

export type RankListResponse = {
  items: RankListItem[];
};

export type Comparison = {
  headers: string[];
  table: string[][];
  footer: string[];
};

export type CompareResponse = {
  comparison: Comparison;
};

export type DepartmentSummary = {
  name: string;
  code: number;
  summary: Summary;
};

export type ArrearStudent = {
  regno: string;
  name: string;
  arrears: number;
};

export type ArrearsResponse = {
  counts: {
    "1": number;
    "2": number;
    "3+": number;
    "4": number;
    "5": number;
  };
  students: ArrearStudent[];
};

export type ImportResultsResponse = {
  semester: number;
  department_code: number;
  source: string;
  output: string;
  output_path: string;
  filter: {
    regno_slug: string | null;
    batch: string | null;
    effective_slug: string | null;
  };
  count: number;
};

export type ImportPreviewPageEntry = {
  semester: number;
  batch: string;
  pages: number[];
};

export type ImportPreviewResponse = {
  source: string;
  semesters: number[];
  batches_by_semester: Record<string, string[]>;
  pages_by_semester_batch: ImportPreviewPageEntry[];
};

export type StorageFolderResponse = {
  folder: string;
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
