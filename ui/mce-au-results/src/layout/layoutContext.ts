import type { DepartmentOption } from "../types/api";

export type LayoutOutletContext = {
  department: string;
  semester: number;
  availableSemesters: number[];
  batch: string;
  availableBatches: string[];
  departments: DepartmentOption[];
};
