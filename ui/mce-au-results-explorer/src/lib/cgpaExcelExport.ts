import * as XLSX from "xlsx";
import {
  api,
  type CgpaBreakdownResponse,
  type CgpaClassResponse,
} from "./api";

type SerializableCell = string | number | null;

type WorksheetRow = Record<string, SerializableCell>;

export type CgpaExportProgress = {
  completed: number;
  total: number;
  currentRegno: string;
};

export type ExportCgpaWorkbookParams = {
  semesters: number[];
  department: string;
  batch: string | null;
  concurrency?: number;
  onProgress?: (progress: CgpaExportProgress) => void;
};

export type ExportCgpaWorkbookResult = {
  fileName: string;
  totalStudents: number;
  failedRegnos: string[];
};

const DEFAULT_CONCURRENCY = 8;

const sanitizeToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "na";

const toNormalizedSemesters = (semesters: number[]): number[] =>
  [...new Set(semesters)]
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((a, b) => a - b);

const getSemesterSubjectColumns = (
  breakdownByRegno: Map<string, CgpaBreakdownResponse>,
  semester: number,
): string[] => {
  const subjectCodes = new Set<string>();

  breakdownByRegno.forEach((breakdown) => {
    const semesterBreakdown = breakdown.semesters.find(
      (item) => item.semester === semester,
    );
    if (!semesterBreakdown) {
      return;
    }

    semesterBreakdown.subjects.forEach((subject) => {
      if (subject.code.trim()) {
        subjectCodes.add(subject.code.trim());
      }
    });
  });

  return [...subjectCodes].sort((a, b) => a.localeCompare(b));
};

const createSemesterSheetRows = (
  classPayload: CgpaClassResponse,
  breakdownByRegno: Map<string, CgpaBreakdownResponse>,
  semester: number,
  subjectColumns: string[],
): WorksheetRow[] => {
  return classPayload.rows.map((student) => {
    const row: WorksheetRow = {
      "Register No": student.regno,
      Name: student.name,
    };

    const breakdown = breakdownByRegno.get(student.regno);
    const semesterBreakdown = breakdown?.semesters.find(
      (item) => item.semester === semester,
    );

    const gradeBySubject = new Map<string, string>();
    semesterBreakdown?.subjects.forEach((subject) => {
      gradeBySubject.set(subject.code, subject.grade);
    });

    subjectColumns.forEach((subjectCode) => {
      row[subjectCode] = gradeBySubject.get(subjectCode) ?? "";
    });

    const classSgpa = student.semester_sgpa[String(semester)] ?? null;
    row.SGPA = semesterBreakdown?.totals.sgpa ?? classSgpa;
    return row;
  });
};

const createSummarySheetRows = (
  classPayload: CgpaClassResponse,
  semesters: number[],
): WorksheetRow[] => {
  return classPayload.rows.map((student) => {
    const row: WorksheetRow = {
      "Register No": student.regno,
      Name: student.name,
    };

    semesters.forEach((semester) => {
      row[`S${semester} SGPA`] = student.semester_sgpa[String(semester)] ?? null;
    });

    row.CGPA = student.cgpa;
    return row;
  });
};

const setSheetColumns = (
  sheet: XLSX.WorkSheet,
  middleColumnsCount: number,
  trailingMetricColumnsCount: number,
) => {
  const columns = [
    { wch: 16 },
    { wch: 34 },
    ...Array.from({ length: middleColumnsCount }, () => ({ wch: 12 })),
    ...Array.from({ length: trailingMetricColumnsCount }, () => ({ wch: 10 })),
  ];

  sheet["!cols"] = columns;
};

const buildWorkbook = (
  classPayload: CgpaClassResponse,
  breakdownByRegno: Map<string, CgpaBreakdownResponse>,
  semesters: number[],
): XLSX.WorkBook => {
  const workbook = XLSX.utils.book_new();

  semesters.forEach((semester) => {
    const subjectColumns = getSemesterSubjectColumns(breakdownByRegno, semester);
    const semesterRows = createSemesterSheetRows(
      classPayload,
      breakdownByRegno,
      semester,
      subjectColumns,
    );

    const headers = ["Register No", "Name", ...subjectColumns, "SGPA"];
    const worksheet = XLSX.utils.json_to_sheet(semesterRows, {
      header: headers,
    });

    setSheetColumns(worksheet, subjectColumns.length, 1);
    XLSX.utils.book_append_sheet(workbook, worksheet, `S${semester}`);
  });

  const summaryRows = createSummarySheetRows(classPayload, semesters);
  const summaryHeaders = [
    "Register No",
    "Name",
    ...semesters.map((semester) => `S${semester} SGPA`),
    "CGPA",
  ];

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows, {
    header: summaryHeaders,
  });

  setSheetColumns(summarySheet, semesters.length, 1);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  return workbook;
};

const saveWorkbook = (workbook: XLSX.WorkBook, fileName: string) => {
  const data = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
  });

  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};

const fetchAllBreakdowns = async (
  classPayload: CgpaClassResponse,
  params: {
    semestersCsv: string;
    department: string;
    batch: string | null;
    concurrency: number;
    onProgress?: (progress: CgpaExportProgress) => void;
  },
): Promise<{
  breakdownByRegno: Map<string, CgpaBreakdownResponse>;
  failedRegnos: string[];
}> => {
  const total = classPayload.rows.length;
  const breakdownByRegno = new Map<string, CgpaBreakdownResponse>();
  const failedRegnos: string[] = [];

  if (total === 0) {
    return { breakdownByRegno, failedRegnos };
  }

  let cursor = 0;
  let completed = 0;
  const normalizedConcurrency = Math.min(Math.max(params.concurrency, 1), total);

  const worker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;

      if (index >= total) {
        return;
      }

      const student = classPayload.rows[index];

      try {
        const breakdown = await api.getCgpaBreakdown({
          semesters: params.semestersCsv,
          department: params.department,
          batch: params.batch,
          regno: student.regno,
        });
        breakdownByRegno.set(student.regno, breakdown);
      } catch {
        failedRegnos.push(student.regno);
      } finally {
        completed += 1;
        params.onProgress?.({
          completed,
          total,
          currentRegno: student.regno,
        });
      }
    }
  };

  await Promise.all(
    Array.from({ length: normalizedConcurrency }, async () => {
      await worker();
    }),
  );

  return { breakdownByRegno, failedRegnos };
};

const buildExportFileName = (
  department: string,
  batch: string | null,
  semesters: number[],
): string => {
  const timestamp = new Date().toISOString().slice(0, 10);
  const semesterToken = semesters.map((semester) => `s${semester}`).join("-");
  const batchToken = batch?.trim() ? sanitizeToken(batch) : "all-batches";
  const departmentToken = sanitizeToken(department);

  return `cgpa-calculation-${departmentToken}-${batchToken}-${semesterToken}-${timestamp}.xlsx`;
};

export const exportCgpaWorkbook = async (
  params: ExportCgpaWorkbookParams,
): Promise<ExportCgpaWorkbookResult> => {
  const semesters = toNormalizedSemesters(params.semesters);

  if (semesters.length === 0) {
    throw new Error("Select at least one semester before exporting.");
  }

  const semestersCsv = semesters.join(",");
  const classPayload = await api.getCgpaClass({
    semesters: semestersCsv,
    department: params.department,
    batch: params.batch,
    sortBy: "cgpa",
  });

  const { breakdownByRegno, failedRegnos } = await fetchAllBreakdowns(
    classPayload,
    {
      semestersCsv,
      department: params.department,
      batch: params.batch,
      concurrency: params.concurrency ?? DEFAULT_CONCURRENCY,
      onProgress: params.onProgress,
    },
  );

  const workbook = buildWorkbook(classPayload, breakdownByRegno, semesters);
  const fileName = buildExportFileName(params.department, params.batch, semesters);
  saveWorkbook(workbook, fileName);

  return {
    fileName,
    totalStudents: classPayload.rows.length,
    failedRegnos,
  };
};
