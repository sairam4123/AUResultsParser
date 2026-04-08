from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping

from backend.constants import get_subject_name, grade_mapping, subject_credit_mapping

FAIL_GRADES = {"U", "UA"}


@dataclass
class SemesterStats:
    credits: float = 0.0
    grade_points: float = 0.0
    arrears: int = 0

    @property
    def sgpa(self) -> float | None:
        if self.credits <= 0:
            return None
        return self.grade_points / self.credits


@dataclass
class StudentAggregate:
    regno: str
    name: str
    semesters: dict[int, SemesterStats] = field(default_factory=dict)

    @property
    def total_credits(self) -> float:
        return sum(stats.credits for stats in self.semesters.values())

    @property
    def total_grade_points(self) -> float:
        return sum(stats.grade_points for stats in self.semesters.values())

    @property
    def cgpa(self) -> float | None:
        if self.total_credits <= 0:
            return None
        return self.total_grade_points / self.total_credits

    @property
    def total_arrears(self) -> int:
        return sum(stats.arrears for stats in self.semesters.values())


@dataclass
class StudentSubjects:
    regno: str
    name: str
    semesters: dict[int, dict[str, str]] = field(default_factory=dict)


def _extract_subjects(row: Mapping[str, Any]) -> dict[str, str] | None:
    subjects = row.get("subjects")
    if not isinstance(subjects, dict):
        return None

    normalized: dict[str, str] = {}
    for code, grade in subjects.items():
        if not isinstance(code, str):
            continue
        normalized[code] = str(grade).strip()

    return normalized


def _accumulate_subjects(stats: SemesterStats, subjects: Mapping[str, str]):
    for subject_code, grade_value in subjects.items():
        grade = str(grade_value).strip()
        credit = float(subject_credit_mapping.get(subject_code, 0))

        if credit <= 0 or grade == "NA":
            continue

        gp = grade_mapping.get(grade)
        if gp is None:
            continue

        stats.credits += credit
        stats.grade_points += float(gp) * credit
        if grade in FAIL_GRADES:
            stats.arrears += 1


def compute_semester_stats(subjects: Mapping[str, str]) -> SemesterStats:
    stats = SemesterStats()
    _accumulate_subjects(stats, subjects)
    return stats


def _load_student_subjects(
    results_by_semester: Mapping[int, list[dict[str, Any]]],
    target_regnos: set[str] | None = None,
) -> dict[str, StudentSubjects]:
    students: dict[str, StudentSubjects] = {}

    for semester, rows in results_by_semester.items():
        for row in rows:
            regno = str(row.get("regno", "")).strip()
            if not regno:
                continue
            if target_regnos and regno not in target_regnos:
                continue

            name = str(row.get("name", "N/A")).strip() or "N/A"
            subjects = _extract_subjects(row)
            if subjects is None:
                continue

            student = students.get(regno)
            if student is None:
                student = StudentSubjects(regno=regno, name=name)
                students[regno] = student
            elif student.name == "N/A" and name != "N/A":
                student.name = name

            student.semesters[semester] = subjects

    return students


def build_class_cgpa_payload(
    results_by_semester: Mapping[int, list[dict[str, Any]]],
    semesters: list[int],
    regno_filter: str | None,
    sort_by: str,
    top: int | None,
) -> dict[str, Any]:
    students: dict[str, StudentAggregate] = {}

    for semester in semesters:
        rows = results_by_semester.get(semester, [])
        for row in rows:
            regno = str(row.get("regno", "")).strip()
            if not regno:
                continue
            if regno_filter and regno != regno_filter:
                continue

            name = str(row.get("name", "N/A")).strip() or "N/A"
            subjects = _extract_subjects(row)
            if subjects is None:
                continue

            student = students.get(regno)
            if student is None:
                student = StudentAggregate(regno=regno, name=name)
                students[regno] = student
            elif student.name == "N/A" and name != "N/A":
                student.name = name

            semester_stats = student.semesters.setdefault(semester, SemesterStats())
            _accumulate_subjects(semester_stats, subjects)

    entries = list(students.values())
    all_entries = list(entries)

    if sort_by == "cgpa":
        entries.sort(
            key=lambda item: (
                item.cgpa is None,
                -(item.cgpa if item.cgpa is not None else -1),
                item.regno,
            )
        )
    elif sort_by == "arrears":
        entries.sort(
            key=lambda item: (
                -item.total_arrears,
                -(item.cgpa if item.cgpa is not None else -1),
                item.regno,
            )
        )
    else:
        entries.sort(key=lambda item: item.regno)

    if top is not None and top > 0:
        entries = entries[:top]

    rows_payload: list[dict[str, Any]] = []
    for student in entries:
        semester_sgpa: dict[str, float | None] = {}
        for semester in semesters:
            sgpa = student.semesters.get(semester, SemesterStats()).sgpa
            semester_sgpa[str(semester)] = None if sgpa is None else round(sgpa, 2)

        rows_payload.append(
            {
                "regno": student.regno,
                "name": student.name,
                "semester_sgpa": semester_sgpa,
                "cgpa": None if student.cgpa is None else round(student.cgpa, 2),
                "arrears": student.total_arrears,
                "credits": round(student.total_credits, 1),
            }
        )

    cgpas = [student.cgpa for student in all_entries if student.cgpa is not None]
    average_cgpa = (sum(cgpas) / len(cgpas)) if cgpas else 0.0
    total_arrears = sum(student.total_arrears for student in all_entries)
    zero_arrears = sum(1 for student in all_entries if student.total_arrears == 0)

    return {
        "summary": {
            "students_considered": len(all_entries),
            "average_cgpa": round(average_cgpa, 2),
            "total_arrears": total_arrears,
            "students_without_arrears": zero_arrears,
        },
        "rows": rows_payload,
    }


def build_student_breakdown_payload(
    results_by_semester: Mapping[int, list[dict[str, Any]]],
    regno: str,
) -> dict[str, Any] | None:
    students = _load_student_subjects(results_by_semester, target_regnos={regno})
    student = students.get(regno)
    if student is None:
        return None

    overall_credits = 0.0
    overall_grade_points = 0.0
    overall_arrears = 0

    semester_payload: list[dict[str, Any]] = []
    for semester in sorted(student.semesters):
        subjects = student.semesters[semester]
        stats = compute_semester_stats(subjects)

        subject_rows: list[dict[str, Any]] = []
        for subject_code in sorted(subjects):
            grade = str(subjects[subject_code]).strip()
            credit = float(subject_credit_mapping.get(subject_code, 0))
            gp = grade_mapping.get(grade)
            included = credit > 0 and grade != "NA" and gp is not None
            weighted = float(gp) * credit if included and gp is not None else 0.0

            subject_rows.append(
                {
                    "code": subject_code,
                    "name": get_subject_name(subject_code),
                    "grade": grade,
                    "credit": round(credit, 1),
                    "gp": gp,
                    "credit_x_gp": round(weighted, 2),
                    "included": included,
                }
            )

        semester_payload.append(
            {
                "semester": semester,
                "subjects": subject_rows,
                "totals": {
                    "credits": round(stats.credits, 1),
                    "grade_points": round(stats.grade_points, 2),
                    "sgpa": None if stats.sgpa is None else round(stats.sgpa, 2),
                    "arrears": stats.arrears,
                },
            }
        )

        overall_credits += stats.credits
        overall_grade_points += stats.grade_points
        overall_arrears += stats.arrears

    cgpa = (overall_grade_points / overall_credits) if overall_credits > 0 else None

    return {
        "regno": student.regno,
        "name": student.name,
        "semesters": semester_payload,
        "overall": {
            "credits": round(overall_credits, 1),
            "grade_points": round(overall_grade_points, 2),
            "cgpa": None if cgpa is None else round(cgpa, 2),
            "arrears": overall_arrears,
        },
    }


def build_compare_breakdown_payload(
    results_by_semester: Mapping[int, list[dict[str, Any]]],
    regno1: str,
    regno2: str,
    include_subject_details: bool,
) -> dict[str, Any] | None:
    students = _load_student_subjects(
        results_by_semester, target_regnos={regno1, regno2}
    )
    student1 = students.get(regno1)
    student2 = students.get(regno2)

    if student1 is None or student2 is None:
        return None

    semesters = sorted(set(student1.semesters.keys()) | set(student2.semesters.keys()))

    total1 = SemesterStats()
    total2 = SemesterStats()

    summary_rows: list[dict[str, Any]] = []
    detail_rows_by_semester: list[dict[str, Any]] = []

    for semester in semesters:
        subjects1 = student1.semesters.get(semester, {})
        subjects2 = student2.semesters.get(semester, {})

        sem1 = compute_semester_stats(subjects1)
        sem2 = compute_semester_stats(subjects2)

        total1.credits += sem1.credits
        total1.grade_points += sem1.grade_points
        total1.arrears += sem1.arrears

        total2.credits += sem2.credits
        total2.grade_points += sem2.grade_points
        total2.arrears += sem2.arrears

        sgpa_diff = (
            sem1.sgpa - sem2.sgpa
            if sem1.sgpa is not None and sem2.sgpa is not None
            else None
        )

        summary_rows.append(
            {
                "metric": f"S{semester}",
                "student1_value": None if sem1.sgpa is None else round(sem1.sgpa, 2),
                "student2_value": None if sem2.sgpa is None else round(sem2.sgpa, 2),
                "diff": None if sgpa_diff is None else round(sgpa_diff, 2),
                "student1_arrears": sem1.arrears,
                "student2_arrears": sem2.arrears,
                "student1_credits": round(sem1.credits, 1),
                "student2_credits": round(sem2.credits, 1),
            }
        )

        if include_subject_details:
            subject_rows: list[dict[str, Any]] = []
            for subject_code in sorted(set(subjects1.keys()) | set(subjects2.keys())):
                grade1 = subjects1.get(subject_code, "-")
                grade2 = subjects2.get(subject_code, "-")
                credit = float(subject_credit_mapping.get(subject_code, 0))

                gp1 = grade_mapping.get(grade1) if grade1 != "-" else None
                gp2 = grade_mapping.get(grade2) if grade2 != "-" else None

                weighted1 = (
                    float(gp1) * credit
                    if gp1 is not None and credit > 0 and grade1 != "NA"
                    else 0.0
                )
                weighted2 = (
                    float(gp2) * credit
                    if gp2 is not None and credit > 0 and grade2 != "NA"
                    else 0.0
                )

                subject_rows.append(
                    {
                        "code": subject_code,
                        "name": get_subject_name(subject_code),
                        "credit": round(credit, 1),
                        "student1_grade": grade1,
                        "student2_grade": grade2,
                        "student1_credit_x_gp": round(weighted1, 2),
                        "student2_credit_x_gp": round(weighted2, 2),
                        "diff": round(weighted1 - weighted2, 2),
                    }
                )

            detail_rows_by_semester.append(
                {
                    "semester": semester,
                    "rows": subject_rows,
                }
            )

    cgpa1 = (total1.grade_points / total1.credits) if total1.credits > 0 else None
    cgpa2 = (total2.grade_points / total2.credits) if total2.credits > 0 else None
    cgpa_diff = (cgpa1 - cgpa2) if cgpa1 is not None and cgpa2 is not None else None

    summary_rows.append(
        {
            "metric": "Overall",
            "student1_value": None if cgpa1 is None else round(cgpa1, 2),
            "student2_value": None if cgpa2 is None else round(cgpa2, 2),
            "diff": None if cgpa_diff is None else round(cgpa_diff, 2),
            "student1_arrears": total1.arrears,
            "student2_arrears": total2.arrears,
            "student1_credits": round(total1.credits, 1),
            "student2_credits": round(total2.credits, 1),
        }
    )

    return {
        "student1": {
            "regno": student1.regno,
            "name": student1.name,
        },
        "student2": {
            "regno": student2.regno,
            "name": student2.name,
        },
        "rows": summary_rows,
        "subject_details": detail_rows_by_semester,
    }
