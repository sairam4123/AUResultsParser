from __future__ import annotations

import os
from pathlib import Path

from tabulate import tabulate

from backend.constants import calculate_sgpa, dept_codes, get_subject_name
from backend.db import SQLiteResultRepository
from backend.parser import (
    generate_rank_list,
    get_arrear_students,
    get_sem_result_summary,
    get_student_results,
    get_subject_wise_summary,
)

PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_SQLITE_NAME = "results.sqlite"
LEGACY_SQLITE_NAME = "results.sqlite3"


def resolve_sqlite_db_path() -> Path:
    env_override = os.getenv("AU_RESULTS_DB_PATH", "").strip()
    if env_override:
        return Path(env_override)

    preferred = PROJECT_ROOT / DEFAULT_SQLITE_NAME
    legacy = PROJECT_ROOT / LEGACY_SQLITE_NAME
    if preferred.exists():
        return preferred
    if legacy.exists():
        return legacy
    return preferred


def resolve_department_input(department: str) -> tuple[str, int]:
    value = department.strip().upper()
    if value in dept_codes:
        return value, dept_codes[value]

    if value.isdigit():
        code = int(value)
        for name, dep_code in dept_codes.items():
            if dep_code == code:
                return name, code

    raise ValueError("Invalid department. Use IT/AIML or code.")


def prompt(message: str, default: str | None = None) -> str:
    suffix = f" [{default}]" if default is not None else ""
    value = input(f"{message}{suffix}: ").strip()
    if value:
        return value
    return default or ""


def prompt_int(message: str, default: int | None = None) -> int:
    while True:
        default_text = str(default) if default is not None else None
        value = prompt(message, default_text)
        if value.isdigit():
            return int(value)
        print("Please enter a valid number.")


def choose_semester_dataset(
    repo: SQLiteResultRepository,
) -> tuple[list[dict], int, int, str | None, str | None]:
    semester = prompt_int("Semester", 5)
    department = prompt("Department (IT/AIML or code)", "IT")
    batch_input = prompt("Batch (press Enter for latest)", "")

    _, department_code = resolve_department_input(department)
    batch = batch_input.strip() or None

    rows, resolved_batch, resolved_sem_name = repo.load_semester_effective_results(
        semester_no=semester,
        department_code=department_code,
        batch=batch,
        sem_name=None,
    )

    if not rows:
        print("No SQLite data found for the selected filter.")
        return [], semester, department_code, resolved_batch, resolved_sem_name

    print(
        f"Loaded {len(rows)} students from SQLite"
        f" (batch={resolved_batch}, sem_name={resolved_sem_name})."
    )
    return rows, semester, department_code, resolved_batch, resolved_sem_name


def show_meta(repo: SQLiteResultRepository):
    departments = repo.get_available_department_codes()
    semesters = repo.get_available_semesters()
    batches = repo.get_available_batches()

    print("\nSQLite data overview")
    print("-" * 40)
    print("Department codes:", ", ".join(str(item) for item in departments) or "None")
    print("Semesters:", ", ".join(str(item) for item in semesters) or "None")
    print("Batches:", ", ".join(str(item) for item in batches) or "None")


def show_semester_summary(repo: SQLiteResultRepository):
    rows, semester, _dept_code, _batch, _sem_name = choose_semester_dataset(repo)
    if not rows:
        return

    summary = get_sem_result_summary(rows)
    table = [[key, value] for key, value in summary.items()]
    print(tabulate(table, headers=["Metric", "Value"], tablefmt="grid"))


def show_student_lookup(repo: SQLiteResultRepository):
    rows, semester, _dept_code, _batch, _sem_name = choose_semester_dataset(repo)
    if not rows:
        return

    regno = prompt("Register number")
    student = get_student_results(regno.strip(), rows)
    if not student:
        print("Student not found.")
        return

    subjects = student.get("subjects", {})
    if not isinstance(subjects, dict):
        print("Malformed subject data.")
        return

    result_rows = [
        [
            code,
            get_subject_name(code),
            grade,
            "Pass" if grade not in {"U", "UA"} else "Fail",
        ]
        for code, grade in sorted(subjects.items())
    ]
    print(
        tabulate(
            result_rows, headers=["Code", "Subject", "Grade", "Status"], tablefmt="grid"
        )
    )
    print(f"SGPA: {calculate_sgpa(semester, subjects):.2f}")


def show_rank_list(repo: SQLiteResultRepository):
    rows, semester, _dept_code, _batch, _sem_name = choose_semester_dataset(repo)
    if not rows:
        return

    top_k = prompt_int("Top K", 10)
    rank_rows = generate_rank_list(rows, semester, top_k=top_k)
    print(
        tabulate(rank_rows, headers=["Rank", "RegNo", "Name", "SGPA"], tablefmt="grid")
    )


def show_subject_summary(repo: SQLiteResultRepository):
    rows, _semester, _dept_code, _batch, _sem_name = choose_semester_dataset(repo)
    if not rows:
        return

    summary, footer = get_subject_wise_summary(rows)
    table_rows = [
        [
            code,
            get_subject_name(code),
            stats["appeared"],
            stats["passed"],
            stats["failed"],
            round(float(stats["pass_percentage"]), 2),
        ]
        for code, stats in sorted(summary.items())
    ]

    print(
        tabulate(
            table_rows,
            headers=["Code", "Subject", "Appeared", "Passed", "Failed", "Pass %"],
            tablefmt="grid",
        )
    )
    print("Footer:")
    for key, value in footer.items():
        print(f"- {key}: {value}")


def show_arrears(repo: SQLiteResultRepository):
    rows, _semester, _dept_code, _batch, _sem_name = choose_semester_dataset(repo)
    if not rows:
        return

    bucket = prompt("Bucket (1,2,3+ or empty)", "").strip() or None
    exact_value = prompt("Exact arrear count (or empty)", "").strip()
    exact_count = int(exact_value) if exact_value.isdigit() else None

    if bucket and exact_count is not None:
        print("Use either bucket or exact count, not both.")
        return

    counts, students = get_arrear_students(rows, bucket=bucket, exact_count=exact_count)
    print("Counts:", counts)

    if students:
        print(tabulate(students, headers="keys", tablefmt="grid"))
    else:
        print("No students matched the arrear filter.")


def main() -> int:
    db_path = resolve_sqlite_db_path()
    repository = SQLiteResultRepository(db_path)
    repository.initialize_schema()

    print("AU Results SQLite Explorer")
    print("=" * 40)
    print(f"Using DB: {db_path}")

    actions = {
        "1": ("Show SQLite meta", show_meta),
        "2": ("Semester summary", show_semester_summary),
        "3": ("Student lookup", show_student_lookup),
        "4": ("Rank list", show_rank_list),
        "5": ("Subject summary", show_subject_summary),
        "6": ("Arrear explorer", show_arrears),
        "9": ("Exit", None),
    }

    while True:
        print("\nMenu")
        for key in sorted(actions):
            print(f"{key}. {actions[key][0]}")

        choice = input("Select option: ").strip()
        if choice == "9":
            print("Exiting.")
            return 0

        item = actions.get(choice)
        if item is None:
            print("Invalid choice.")
            continue

        try:
            handler = item[1]
            if handler is not None:
                handler(repository)
        except Exception as exc:
            print(f"Error: {exc}")


if __name__ == "__main__":
    raise SystemExit(main())
