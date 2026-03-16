import type { DepartmentOption } from "../types/api";

export type LayoutOutletContext = {
  department: string;
  semester: number;
  departments: DepartmentOption[];
};
