import type { ArrearsResponse } from "../../lib/api";
import type { SubjectComparisonTable, StudentSubjects } from "./types";

const gradePointMap: Record<string, number> = {
  O: 10,
  "A+": 9,
  A: 8,
  "B+": 7,
  B: 6,
  C: 5,
  U: 0,
  UA: 0,
  NC: 0,
  NA: 0,
};

export const cardTone = [
  "var(--tone-a)",
  "var(--tone-b)",
  "var(--tone-c)",
  "var(--tone-d)",
];

export const fmtNumber = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(value);
};

export const fmtMaybe = (value: number | null | undefined, suffix = "") => {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  return `${value.toFixed(2)}${suffix}`;
};

export const mergeArrearStudents = (
  groups: Array<ArrearsResponse["students"] | null>,
): ArrearsResponse["students"] => {
  const byRegno = new Map<string, ArrearsResponse["students"][number]>();

  for (const group of groups) {
    if (!group) {
      continue;
    }
    for (const item of group) {
      byRegno.set(item.regno, item);
    }
  }

  return Array.from(byRegno.values()).sort((a, b) => {
    if (a.arrears !== b.arrears) {
      return a.arrears - b.arrears;
    }
    return a.regno.localeCompare(b.regno);
  });
};

export const parseSemestersInput = (value: string): string | null => {
  const parsed = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);

  if (parsed.length === 0) {
    return null;
  }

  const unique = Array.from(new Set(parsed));
  return unique.join(",");
};

export const buildSubjectComparisonTable = (
  students: StudentSubjects,
): SubjectComparisonTable => {
  const subjectMap = new Map<
    string,
    {
      code: string;
      name: string;
      semester: number | null;
    }
  >();
  const perStudentSubjects = students.map((student) => {
    const map = new Map<string, string>();
    for (const subject of student.subjects) {
      const semesterValue = (subject as { semester?: number }).semester;
      const semester =
        typeof semesterValue === "number" && Number.isFinite(semesterValue)
          ? semesterValue
          : null;
      const subjectKey =
        semester == null ? subject.code : `S${semester}::${subject.code}`;

      map.set(subjectKey, subject.grade);
      if (!subjectMap.has(subjectKey)) {
        subjectMap.set(subjectKey, {
          code: subject.code,
          name: subject.name,
          semester,
        });
      }
    }
    return map;
  });

  const subjectKeys = Array.from(subjectMap.keys()).sort((left, right) => {
    const leftMeta = subjectMap.get(left)!;
    const rightMeta = subjectMap.get(right)!;

    if (leftMeta.semester == null && rightMeta.semester != null) {
      return 1;
    }
    if (leftMeta.semester != null && rightMeta.semester == null) {
      return -1;
    }

    if (
      leftMeta.semester != null &&
      rightMeta.semester != null &&
      leftMeta.semester !== rightMeta.semester
    ) {
      return leftMeta.semester - rightMeta.semester;
    }

    return leftMeta.code.localeCompare(rightMeta.code);
  });

  const rows = subjectKeys.map((subjectKey) => {
    const points = perStudentSubjects.map((subjectGrades) => {
      const grade = subjectGrades.get(subjectKey) ?? "NA";
      return gradePointMap[grade] ?? 0;
    });

    const min = Math.min(...points);
    const max = Math.max(...points);

    const subjectMeta = subjectMap.get(subjectKey);

    return {
      semester: subjectMeta?.semester ?? null,
      subjectCode: subjectMeta?.code ?? "N/A",
      subjectName: subjectMeta?.name ?? "N/A",
      points: points.map((value) => ({ value, diff: value - min })),
      spread: max - min,
    };
  });

  const totalPoints = students.map((student) =>
    student.subjects.reduce(
      (sum, subject) => sum + (gradePointMap[subject.grade] ?? 0),
      0,
    ),
  );

  const totalMin = Math.min(...totalPoints);
  const totalMax = Math.max(...totalPoints);

  rows.push({
    semester: null,
    subjectCode: "Total GP",
    subjectName: "",
    points: totalPoints.map((value) => ({ value, diff: value - totalMin })),
    spread: totalMax - totalMin,
  });

  const headers = [
    "Subject",
    "Subject Name",
    ...students.map((student) => `${student.name} (${student.regno.slice(-3)})`),
    "Spread",
  ];

  const footer = students.map(
    (student) => `Avg SGPA ${student.regno}: ${student.sgpa.toFixed(2)}`,
  );

  return { headers, rows, footer };
};
