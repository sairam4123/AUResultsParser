from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from tabulate import tabulate

from backend.constants import grade_mapping, subject_credit_mapping

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


def parse_semester_from_filename(file_path: Path) -> int:
    match = re.search(r"_sem_(\d+)_", file_path.name)
    if not match:
        raise ValueError(
            f"Could not infer semester from filename '{file_path.name}'. "
            "Expected pattern like *_sem_3_*.json"
        )
    return int(match.group(1))


def load_json_results(file_path: Path) -> list[dict[str, Any]]:
    with file_path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, list):
        raise ValueError(f"Expected a list in '{file_path}', found {type(payload)}")
    return payload


def accumulate_subjects(
    student: StudentAggregate, semester: int, subjects: dict[str, str]
):
    stats = student.semesters.setdefault(semester, SemesterStats())

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


def aggregate_results(
    files: list[Path], regno_filter: str | None
) -> tuple[dict[str, StudentAggregate], list[int]]:
    students: dict[str, StudentAggregate] = {}
    semesters: set[int] = set()

    for file_path in files:
        semester = parse_semester_from_filename(file_path)
        semesters.add(semester)

        rows = load_json_results(file_path)
        for row in rows:
            regno = str(row.get("regno", "")).strip()
            if not regno:
                continue
            if regno_filter and regno != regno_filter:
                continue

            name = str(row.get("name", "N/A")).strip() or "N/A"
            subjects = row.get("subjects")
            if not isinstance(subjects, dict):
                continue

            student = students.get(regno)
            if student is None:
                student = StudentAggregate(regno=regno, name=name)
                students[regno] = student
            elif student.name == "N/A" and name != "N/A":
                student.name = name

            accumulate_subjects(student, semester, subjects)

    return students, sorted(semesters)


def build_table_rows(
    students: dict[str, StudentAggregate],
    semesters: list[int],
    sort_by: str,
    top: int | None,
) -> list[list[str | int]]:
    entries = list(students.values())

    if sort_by == "cgpa":
        entries.sort(
            key=lambda s: (
                s.cgpa is None,
                -(s.cgpa if s.cgpa is not None else -1),
                s.regno,
            )
        )
    elif sort_by == "arrears":
        entries.sort(
            key=lambda s: (
                -s.total_arrears,
                -(s.cgpa if s.cgpa is not None else -1),
                s.regno,
            )
        )
    else:
        entries.sort(key=lambda s: s.regno)

    if top is not None and top > 0:
        entries = entries[:top]

    rows: list[list[str | int]] = []
    for student in entries:
        row: list[str | int] = [student.regno, student.name]
        for semester in semesters:
            sgpa = student.semesters.get(semester, SemesterStats()).sgpa
            row.append("-" if sgpa is None else f"{sgpa:.2f}")

        row.append("-" if student.cgpa is None else f"{student.cgpa:.2f}")
        row.append(student.total_arrears)
        row.append(f"{student.total_credits:.1f}")
        rows.append(row)

    return rows


def format_value(value: float | None, precision: int = 2) -> str:
    if value is None:
        return "-"
    return f"{value:.{precision}f}"


def load_student_subjects(
    files: list[Path],
    target_regnos: set[str] | None = None,
) -> dict[str, StudentSubjects]:
    students: dict[str, StudentSubjects] = {}

    for file_path in files:
        semester = parse_semester_from_filename(file_path)
        rows = load_json_results(file_path)

        for row in rows:
            regno = str(row.get("regno", "")).strip()
            if not regno:
                continue
            if target_regnos and regno not in target_regnos:
                continue

            name = str(row.get("name", "N/A")).strip() or "N/A"
            subjects = row.get("subjects")
            if not isinstance(subjects, dict):
                continue

            student = students.get(regno)
            if student is None:
                student = StudentSubjects(regno=regno, name=name)
                students[regno] = student
            elif student.name == "N/A" and name != "N/A":
                student.name = name

            student.semesters[semester] = {
                str(subject): str(grade).strip() for subject, grade in subjects.items()
            }

    return students


def compute_semester_stats(subjects: dict[str, str]) -> SemesterStats:
    stats = SemesterStats()

    for subject_code, grade_value in subjects.items():
        grade = str(grade_value).strip()
        credit = float(subject_credit_mapping.get(subject_code, 0))
        gp = grade_mapping.get(grade)

        if credit <= 0 or grade == "NA" or gp is None:
            continue

        stats.credits += credit
        stats.grade_points += float(gp) * credit
        if grade in FAIL_GRADES:
            stats.arrears += 1

    return stats


def build_subject_breakdown_rows(subjects: dict[str, str]) -> list[list[str]]:
    rows: list[list[str]] = []

    for subject in sorted(subjects):
        grade = str(subjects[subject]).strip()
        credit = float(subject_credit_mapping.get(subject, 0))
        gp = grade_mapping.get(grade)
        included = credit > 0 and grade != "NA" and gp is not None
        if included and gp is not None:
            weighted = float(gp) * credit
        else:
            weighted = 0.0

        rows.append(
            [
                subject,
                grade,
                format_value(credit, precision=1),
                "-" if gp is None else str(gp),
                format_value(weighted),
                "Yes" if included else "No",
            ]
        )

    return rows


def print_student_breakdown(files: list[Path], regno: str) -> int:
    students = load_student_subjects(files, target_regnos={regno})
    student = students.get(regno)
    if not student:
        print(f"No records found for regno {regno} in selected files.")
        return 1

    print(f"\nCGPA Breakdown: {student.name} ({student.regno})")

    overall_credits = 0.0
    overall_grade_points = 0.0
    overall_arrears = 0

    for semester in sorted(student.semesters):
        subjects = student.semesters[semester]
        sem_stats = compute_semester_stats(subjects)
        rows = build_subject_breakdown_rows(subjects)

        print(f"\nSemester {semester}")
        print(
            tabulate(
                rows,
                headers=[
                    "Subject",
                    "Grade",
                    "Credit",
                    "GP",
                    "Credit x GP",
                    "Included",
                ],
                tablefmt="grid",
            )
        )

        sgpa = sem_stats.sgpa
        print(
            f"SGPA(S{semester}) = {sem_stats.grade_points:.2f} / {sem_stats.credits:.1f} = {format_value(sgpa)}"
        )
        print(f"Arrears in S{semester}: {sem_stats.arrears}")

        overall_credits += sem_stats.credits
        overall_grade_points += sem_stats.grade_points
        overall_arrears += sem_stats.arrears

    cgpa = (overall_grade_points / overall_credits) if overall_credits > 0 else None
    print("\nOverall")
    print(
        f"CGPA = {overall_grade_points:.2f} / {overall_credits:.1f} = {format_value(cgpa)}"
    )
    print(f"Total arrears: {overall_arrears}")

    return 0


def print_compare_breakdown(
    files: list[Path],
    regno1: str,
    regno2: str,
    subject_details: bool,
) -> int:
    students = load_student_subjects(files, target_regnos={regno1, regno2})
    student1 = students.get(regno1)
    student2 = students.get(regno2)

    if not student1:
        print(f"No records found for regno {regno1} in selected files.")
        return 1
    if not student2:
        print(f"No records found for regno {regno2} in selected files.")
        return 1

    print(f"\nComparison: {student1.name} ({regno1}) vs {student2.name} ({regno2})")

    semesters = sorted(set(student1.semesters.keys()) | set(student2.semesters.keys()))

    total1 = SemesterStats()
    total2 = SemesterStats()
    summary_rows: list[list[str]] = []

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
            (sem1.sgpa - sem2.sgpa)
            if sem1.sgpa is not None and sem2.sgpa is not None
            else None
        )

        summary_rows.append(
            [
                f"S{semester}",
                format_value(sem1.sgpa),
                format_value(sem2.sgpa),
                format_value(sgpa_diff),
                str(sem1.arrears),
                str(sem2.arrears),
                format_value(sem1.credits, precision=1),
                format_value(sem2.credits, precision=1),
            ]
        )

        if subject_details:
            subject_rows: list[list[str]] = []
            for subject in sorted(set(subjects1.keys()) | set(subjects2.keys())):
                grade1 = subjects1.get(subject, "-")
                grade2 = subjects2.get(subject, "-")
                credit = float(subject_credit_mapping.get(subject, 0))

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
                    [
                        subject,
                        format_value(credit, precision=1),
                        grade1,
                        format_value(weighted1),
                        grade2,
                        format_value(weighted2),
                        format_value(weighted1 - weighted2),
                    ]
                )

            print(f"\nSubject Detail Comparison - Semester {semester}")
            print(
                tabulate(
                    subject_rows,
                    headers=[
                        "Subject",
                        "Credit",
                        f"{regno1[-3:]} Grade",
                        f"{regno1[-3:]} Credit x GP",
                        f"{regno2[-3:]} Grade",
                        f"{regno2[-3:]} Credit x GP",
                        "Diff",
                    ],
                    tablefmt="grid",
                )
            )

    cgpa1 = (total1.grade_points / total1.credits) if total1.credits > 0 else None
    cgpa2 = (total2.grade_points / total2.credits) if total2.credits > 0 else None
    cgpa_diff = (cgpa1 - cgpa2) if cgpa1 is not None and cgpa2 is not None else None

    summary_rows.append(
        [
            "Overall",
            format_value(cgpa1),
            format_value(cgpa2),
            format_value(cgpa_diff),
            str(total1.arrears),
            str(total2.arrears),
            format_value(total1.credits, precision=1),
            format_value(total2.credits, precision=1),
        ]
    )

    print("\nSGPA / CGPA Comparison")
    print(
        tabulate(
            summary_rows,
            headers=[
                "Metric",
                f"{regno1[-3:]} Value",
                f"{regno2[-3:]} Value",
                "Diff",
                f"{regno1[-3:]} Arrears",
                f"{regno2[-3:]} Arrears",
                f"{regno1[-3:]} Credits",
                f"{regno2[-3:]} Credits",
            ],
            tablefmt="grid",
        )
    )

    return 0


def print_summary(students: dict[str, StudentAggregate]):
    if not students:
        return

    values = list(students.values())
    cgpas = [student.cgpa for student in values if student.cgpa is not None]
    average_cgpa = sum(cgpas) / len(cgpas) if cgpas else 0.0
    total_arrears = sum(student.total_arrears for student in values)
    zero_arrears = sum(1 for student in values if student.total_arrears == 0)

    print("\nClass Summary")
    print(f"Students considered : {len(values)}")
    print(f"Average CGPA        : {average_cgpa:.2f}")
    print(f"Total arrears       : {total_arrears}")
    print(f"Students with no arrears: {zero_arrears}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Calculate CGPA and arrears across multiple semester result exports."
    )
    parser.add_argument(
        "--files",
        nargs="+",
        required=False,
        help="Semester result JSON files (e.g., 2023_sem_3_results_205.json ...)",
    )
    parser.add_argument(
        "--regno",
        default=None,
        help="Optional registration number to compute for a single student.",
    )
    parser.add_argument(
        "--breakdown",
        default=None,
        help="Detailed CGPA breakdown for one registration number.",
    )
    parser.add_argument(
        "--compare",
        default=None,
        help="Compare with another registration number (use with --breakdown).",
    )
    parser.add_argument(
        "--subject-details",
        action="store_true",
        help="Include per-subject comparison details in compare mode.",
    )
    parser.add_argument(
        "--sort",
        choices=["cgpa", "arrears", "regno"],
        default="cgpa",
        help="Sort output by CGPA, arrears, or regno.",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=None,
        help="Optional number of top rows to display after sorting.",
    )
    parser.add_argument(
        "--interactive",
        action="store_true",
        help="Launch menu-driven interactive mode.",
    )
    return parser.parse_args()


def discover_result_files(base_dir: Path) -> list[Path]:
    return sorted(base_dir.glob("*_sem_*_results_*.json"), key=lambda item: item.name)


def try_default_2023_sem_345(base_dir: Path) -> list[Path]:
    defaults = [
        base_dir / "2023_sem_3_results_205.json",
        base_dir / "2023_sem_4_results_205.json",
        base_dir / "2023_sem_5_results_205.json",
    ]
    return [item for item in defaults if item.exists()]


def prompt_files_interactive(base_dir: Path) -> list[Path] | None:
    discovered = discover_result_files(base_dir)
    defaults = try_default_2023_sem_345(base_dir)

    while True:
        print("\nSelect Input Files")
        print("1. Use default: 2023 sem 3,4,5 (IT-205)")
        print("2. Select from detected export files")
        print("3. Enter file paths manually")
        print("4. Exit")
        choice = input("Choose an option [1-4]: ").strip()

        if choice == "1":
            if len(defaults) != 3:
                print("Default 2023 sem 3/4/5 files were not fully found.")
                continue
            return defaults

        if choice == "2":
            if not discovered:
                print("No matching result files found in current folder.")
                continue

            print("\nDetected Files")
            for idx, file in enumerate(discovered, start=1):
                print(f"{idx}. {file.name}")
            # filter based on the batch and the semester by requesting the user to input batch and semester numbers
            # raw = input(
            #     "Enter comma-separated indices (example: 1,2,3): "
            # ).strip()
            # if not raw:
            #     print("No selection made.")
            #     continue
            batch = input("Enter batch year (e.g., 2023): ").strip()
            semester_nos = input(
                "Enter semester numbers (e.g., 3) [Comma-separated]: "
            ).strip()

            # calculate index set based on batch and semester numbers
            indexes = set()
            for sem in semester_nos.split(","):
                sem = sem.strip()
                if not sem.isdigit():
                    print(f"Invalid semester number: '{sem}'")
                    continue
                sem = int(sem)
                for idx, file in enumerate(discovered, start=1):
                    if f"{batch}_sem_{sem}_" in file.name:
                        indexes.add(idx)

            # try:
            #     indexes = sorted(
            #         {int(part.strip()) for part in raw.split(",") if part.strip()}
            #     )
            # except ValueError:
            #     print("Invalid input. Please enter only numbers and commas.")
            #     continue

            if any(index < 1 or index > len(discovered) for index in indexes):
                print("One or more indices are out of range.")
                continue

            return [discovered[index - 1] for index in indexes]

        if choice == "3":
            raw = input("Enter JSON file paths separated by commas: ").strip()
            if not raw:
                print("No paths entered.")
                continue

            candidates = [
                Path(part.strip()).expanduser().resolve()
                for part in raw.split(",")
                if part.strip()
            ]
            if not candidates:
                print("No valid paths were parsed.")
                continue
            return candidates

        if choice == "4":
            return None

        print("Invalid option. Please choose 1, 2, 3 or 4.")


def prompt_optional_regno() -> str | None:
    value = input("Registration number filter (press Enter to skip): ").strip()
    return value or None


def prompt_sort_mode() -> str:
    print("\nSort By")
    print("1. CGPA (highest first)")
    print("2. Arrears (highest first)")
    print("3. RegNo (ascending)")
    mapping = {"1": "cgpa", "2": "arrears", "3": "regno"}
    while True:
        choice = input("Choose sort mode [1-3] (default 1): ").strip() or "1"
        mode = mapping.get(choice)
        if mode:
            return mode
        print("Invalid option. Please choose 1, 2 or 3.")


def prompt_top_n() -> int | None:
    value = input("Top N rows (press Enter for all): ").strip()
    if not value:
        return None

    try:
        top = int(value)
    except ValueError:
        print("Invalid number. Showing all rows.")
        return None

    if top <= 0:
        print("Top N must be positive. Showing all rows.")
        return None

    return top


def interactive_menu_v2(base_dir: Path) -> dict[str, Any] | None:
    print("\n=== CGPA and Arrears Calculator ===")
    files = prompt_files_interactive(base_dir)
    if files is None:
        return None

    print("\nChoose Action")
    print("1. Class table (CGPA + arrears)")
    print("2. Single student CGPA breakdown")
    print("3. Compare two students breakdown")
    print("4. Exit")

    action = input("Choose an option [1-4]: ").strip()

    if action == "1":
        return {
            "mode": "class",
            "files": files,
            "regno_filter": prompt_optional_regno(),
            "sort_by": prompt_sort_mode(),
            "top": prompt_top_n(),
        }

    if action == "2":
        regno = input("Enter registration number: ").strip()
        if not regno:
            print("Registration number is required.")
            return None
        return {
            "mode": "breakdown",
            "files": files,
            "regno": regno,
        }

    if action == "3":
        regno1 = input("Enter first registration number: ").strip()
        regno2 = input("Enter second registration number: ").strip()
        if not regno1 or not regno2:
            print("Both registration numbers are required.")
            return None

        details = input("Show subject-level details? (y/N): ").strip().lower() in {
            "y",
            "yes",
        }

        return {
            "mode": "compare",
            "files": files,
            "regno1": regno1,
            "regno2": regno2,
            "subject_details": details,
        }

    if action == "4":
        return None

    print("Invalid option.")
    return None


def main() -> int:
    args = parse_args()
    base_dir = Path.cwd()

    use_interactive = args.interactive or len(sys.argv) == 1

    if use_interactive:
        selected = interactive_menu_v2(base_dir)
        if selected is None:
            print("Exiting without running analysis.")
            return 0
        mode = selected["mode"]
        files = selected["files"]

        if mode == "breakdown":
            return print_student_breakdown(files, selected["regno"])

        if mode == "compare":
            return print_compare_breakdown(
                files,
                selected["regno1"],
                selected["regno2"],
                selected["subject_details"],
            )

        regno_filter = selected["regno_filter"]
        sort_by = selected["sort_by"]
        top = selected["top"]
    else:
        if not args.files:
            files = try_default_2023_sem_345(base_dir)
            if len(files) != 3:
                print(
                    "No files provided and default 2023 sem 3/4/5 files were not found."
                )
                print(
                    "Pass --files explicitly, or run interactive mode without arguments."
                )
                return 1
        else:
            files = [Path(file).resolve() for file in args.files]

        if args.compare and not args.breakdown:
            print("--compare requires --breakdown <REGNO>.")
            return 1

        if args.breakdown and args.compare:
            return print_compare_breakdown(
                files,
                args.breakdown,
                args.compare,
                args.subject_details,
            )

        if args.breakdown:
            return print_student_breakdown(files, args.breakdown)

        regno_filter = args.regno
        sort_by = args.sort
        top = args.top

    missing = [str(file) for file in files if not file.exists()]
    if missing:
        print("These files were not found:")
        for file in missing:
            print(f"- {file}")
        return 1

    students, semesters = aggregate_results(files, regno_filter)
    if not students:
        print("No matching student records found in the provided files.")
        return 1

    headers = [
        "RegNo",
        "Name",
        *[f"S{semester} SGPA" for semester in semesters],
        "CGPA",
        "Arrears",
        "Credits",
    ]
    rows = build_table_rows(students, semesters, sort_by, top)

    print_summary(students)
    print("\nCGPA / Arrears Table")
    print(tabulate(rows, headers=headers, tablefmt="grid"))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
