import type { ArrearsResponse, StudentResponse } from "../../lib/api";

export type DataState<T> = {
  loading: boolean;
  error: string | null;
  data: T | null;
};

export const initialDataState = <T,>(): DataState<T> => ({
  loading: false,
  error: null,
  data: null,
});

export type StudentOption = {
  value: string;
  label: string;
};

export type ComparisonPoint = {
  value: number;
  diff: number;
};

export type ComparisonRow = {
  subjectCode: string;
  subjectName: string;
  points: ComparisonPoint[];
  spread: number;
};

export type SubjectComparisonTable = {
  headers: string[];
  rows: ComparisonRow[];
  footer: string[];
};

export type ArrearStudents = ArrearsResponse["students"];
export type StudentSubjects = StudentResponse["student"][];
