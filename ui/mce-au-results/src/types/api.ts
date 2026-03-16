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
