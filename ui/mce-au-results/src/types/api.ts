export type DepartmentOption = {
  name: string;
  code: number;
};

export type Meta = {
  departments: DepartmentOption[];
  semesters: number[];
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

export type StorageFolderResponse = {
  folder: string;
};
