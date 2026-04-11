from __future__ import annotations

import json
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any

from backend.constants import RESULT_STATES
from backend.parser import scan_result_pdf_structure
from backend.pdf_ingestion import ingest_from_payload

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def list_root_pdfs(root_dir: Path = PROJECT_ROOT) -> list[Path]:
    return sorted(
        [path for path in root_dir.glob("*.pdf") if path.is_file()],
        key=lambda path: path.name.lower(),
    )


def infer_department_from_filename(pdf_path: Path) -> str | None:
    match = re.match(r"^(\d{3})_", pdf_path.name)
    if not match:
        return None
    return match.group(1)


def derive_sem_name(
    *,
    pdf_path: Path,
    exam_name: str,
    result_date: str,
    year_format: str = "yy",
) -> str:
    parity = _infer_term_parity(
        exam_name=exam_name, pdf_path=pdf_path, result_date=result_date
    )
    exam_year = _infer_exam_year(
        exam_name=exam_name, pdf_path=pdf_path, result_date=result_date
    )

    if year_format.lower() == "yyyy":
        return f"{exam_year}-{parity}"

    return f"{exam_year % 100:02d}-{parity}"


def _infer_term_parity(*, exam_name: str, pdf_path: Path, result_date: str) -> str:
    hint_text = f"{exam_name} {pdf_path.stem}".upper()

    if "ND" in hint_text:
        return "ODD"
    if "AM" in hint_text:
        return "EVEN"

    try:
        parsed = datetime.fromisoformat(result_date.strip())
        # Heuristic fallback when exam code hint is unavailable.
        return "EVEN" if parsed.month in {4, 5, 6, 7, 8, 9} else "ODD"
    except Exception:
        return "ODD"


def _infer_exam_year(*, exam_name: str, pdf_path: Path, result_date: str) -> int:
    hint_text = f"{exam_name} {pdf_path.stem}".upper()
    match = re.search(r"(?:ND|AM)\s*[-_]?\s*(\d{2,4})", hint_text)
    if match:
        raw = match.group(1)
        value = int(raw)
        return value if len(raw) == 4 else (2000 + value)

    year_match = re.search(r"(20\d{2})", hint_text)
    if year_match:
        return int(year_match.group(1))

    try:
        return datetime.fromisoformat(result_date.strip()).year
    except Exception:
        return date.today().year


def build_default_jobs(
    scan_payload: dict[str, Any],
    *,
    pdf_path: Path,
    department: str,
    state: str,
    exam_name: str,
    result_date: str,
    year_format: str = "yy",
    allowed_batches: set[str] | None = None,
    allowed_semesters: set[int] | None = None,
) -> list[dict[str, Any]]:
    batches_by_sem = scan_payload.get("batches_by_semester", {})
    if not isinstance(batches_by_sem, dict):
        raise ValueError("Invalid scan payload: expected batches_by_semester mapping")

    jobs: list[dict[str, Any]] = []
    shared_sem_name = derive_sem_name(
        pdf_path=pdf_path,
        exam_name=exam_name,
        result_date=result_date,
        year_format=year_format,
    )

    for sem_key in sorted(batches_by_sem.keys(), key=lambda value: int(str(value))):
        sem_no = int(str(sem_key))
        if allowed_semesters is not None and sem_no not in allowed_semesters:
            continue
        batches = batches_by_sem.get(sem_key, [])
        if not isinstance(batches, list):
            continue

        normalized_batches = sorted(
            {
                str(batch).strip()
                for batch in batches
                if str(batch).strip().isdigit() and len(str(batch).strip()) == 4
            }
        )

        for batch in normalized_batches:
            if allowed_batches is not None and batch not in allowed_batches:
                continue

            jobs.append(
                {
                    "name": f"{pdf_path.stem}_sem{sem_no}_{batch}",
                    "mode": "full",
                    "pdf_path": str(pdf_path),
                    "semester": sem_no,
                    "department": department,
                    "batch": batch,
                    "sem_name": shared_sem_name,
                    "state": state,
                    "exam_name": exam_name,
                    "result_date": result_date,
                }
            )

    return jobs


def _prompt(message: str, default: str | None = None) -> str:
    suffix = f" [{default}]" if default else ""
    value = input(f"{message}{suffix}: ").strip()
    if value:
        return value
    if default is not None:
        return default
    return ""


def _normalize_date(date_str: str) -> str:
    for fmt in ("%Y-%m-%d", "%d-%m-%Y"):
        try:
            parsed = datetime.strptime(date_str.strip(), fmt)
            return parsed.date().isoformat()
        except ValueError:
            continue
    raise ValueError("Invalid date format. Use YYYY-MM-DD or DD-MM-YYYY.")


def _prompt_yes_no(message: str, default_yes: bool = True) -> bool:
    default_text = "Y/n" if default_yes else "y/N"
    value = input(f"{message} ({default_text}): ").strip().lower()
    if not value:
        return default_yes
    return value in {"y", "yes"}


def _choose_pdf(pdfs: list[Path]) -> Path:
    print("\nAvailable PDFs in project root:")
    for idx, path in enumerate(pdfs, start=1):
        print(f"{idx}. {path.name}")

    while True:
        selected = input("Select a PDF by number: ").strip()
        if selected.isdigit():
            index = int(selected)
            if 1 <= index <= len(pdfs):
                return pdfs[index - 1]
        print("Invalid selection. Try again.")


def _validate_state(state: str) -> str:
    normalized = state.strip().upper()
    if normalized not in RESULT_STATES:
        raise ValueError(
            f"Invalid state '{state}'. Expected one of: {', '.join(RESULT_STATES)}"
        )
    return normalized


def _print_discovered_structure(scan_payload: dict[str, Any]):
    semesters = scan_payload.get("semesters", [])
    batches_by_sem = scan_payload.get("batches_by_semester", {})

    print("\nDiscovered semesters and batches:")
    if not semesters:
        print("No semester information found in this PDF.")
        return

    for sem in semesters:
        key = str(sem)
        batches = batches_by_sem.get(key, [])
        print(f"- Semester {sem}: batches {', '.join(batches) if batches else 'None'}")


def _collect_discovered_batches(scan_payload: dict[str, Any]) -> list[str]:
    batches_by_sem = scan_payload.get("batches_by_semester", {})
    if not isinstance(batches_by_sem, dict):
        return []

    discovered: set[str] = set()
    for batch_values in batches_by_sem.values():
        if not isinstance(batch_values, list):
            continue
        for batch in batch_values:
            normalized = str(batch).strip()
            if normalized.isdigit() and len(normalized) == 4:
                discovered.add(normalized)

    return sorted(discovered)


def _prompt_batch_limit(scan_payload: dict[str, Any]) -> set[str] | None:
    available_batches = _collect_discovered_batches(scan_payload)
    if not available_batches:
        return None

    print("\nDiscovered batches:", ", ".join(available_batches))
    selected = _prompt(
        "Limit to specific batches? Enter comma-separated values or press Enter for all",
        "",
    ).strip()

    if not selected:
        return None

    requested = {value.strip() for value in selected.split(",") if value.strip()}
    invalid = sorted(requested.difference(set(available_batches)))
    if invalid:
        raise ValueError(
            "Invalid batch values: "
            + ", ".join(invalid)
            + ". Available: "
            + ", ".join(available_batches)
        )

    return requested


def _prompt_semester_limit(scan_payload: dict[str, Any]) -> set[int] | None:
    semesters = scan_payload.get("semesters", [])
    if not isinstance(semesters, list):
        return None

    available = sorted(
        {
            int(str(item))
            for item in semesters
            if str(item).strip().isdigit()
        }
    )
    if not available:
        return None

    print("\nDiscovered semesters:", ", ".join(str(item) for item in available))
    selected = _prompt(
        "Limit to specific semesters? Enter comma-separated values or press Enter for all",
        "",
    ).strip()

    if not selected:
        return None

    requested: set[int] = set()
    for value in selected.split(","):
        token = value.strip()
        if not token:
            continue
        if not token.isdigit():
            raise ValueError(
                f"Invalid semester value '{token}'. Expected numeric semester values."
            )
        requested.add(int(token))

    invalid = sorted(requested.difference(set(available)))
    if invalid:
        raise ValueError(
            "Invalid semesters: "
            + ", ".join(str(item) for item in invalid)
            + ". Available: "
            + ", ".join(str(item) for item in available)
        )

    return requested


def run_interactive() -> int:
    print("AU Results PDF Ingestion (Interactive)")
    print("=" * 50)

    pdfs = list_root_pdfs(PROJECT_ROOT)
    if not pdfs:
        print("No PDF files found in project root.")
        return 1

    pdf_path = _choose_pdf(pdfs)
    print(f"\nSelected PDF: {pdf_path.name}")

    scan_payload = scan_result_pdf_structure(str(pdf_path))
    _print_discovered_structure(scan_payload)

    department_default = infer_department_from_filename(pdf_path) or "205"
    department = _prompt("Department code/name (e.g., 205 or IT)", department_default)
    exam_name = _prompt("Exam name", pdf_path.stem)
    result_date = _prompt(
        "Result published date (YYYY-MM-DD | DD-MM-YYYY)", date.today().isoformat()
    )
    result_date = _normalize_date(result_date)
    state = _validate_state(_prompt("Result state", "PROVISIONAL"))
    year_format = _prompt("sem_name year format (yy or yyyy)", "yy").lower()
    if year_format not in {"yy", "yyyy"}:
        year_format = "yy"
    allowed_semesters = _prompt_semester_limit(scan_payload)
    allowed_batches = _prompt_batch_limit(scan_payload)

    jobs = build_default_jobs(
        scan_payload,
        pdf_path=pdf_path,
        department=department,
        state=state,
        exam_name=exam_name,
        result_date=result_date,
        year_format=year_format,
        allowed_semesters=allowed_semesters,
        allowed_batches=allowed_batches,
    )

    if not jobs:
        print("No semester-batch combinations could be built from this PDF.")
        return 1

    print("\nIngestion plan (default is ingest all):")
    for idx, job in enumerate(jobs, start=1):
        print(
            f"{idx}. Batch {job['batch']}, SemNo {job['semester']}, "
            f"sem_name {job['sem_name']}, state {job['state']}"
        )

    if _prompt_yes_no("Do you want to edit sem_name values?", default_yes=False):
        for job in jobs:
            prompt_label = f"sem_name for batch {job['batch']} sem {job['semester']}"
            job["sem_name"] = _prompt(prompt_label, job["sem_name"])

    db_path = _prompt("SQLite DB path", str(PROJECT_ROOT / "results.sqlite"))
    dry_run = _prompt_yes_no("Dry run only (no DB writes)?", default_yes=False)
    refresh_cache = _prompt_yes_no(
        "Refresh effective grade cache after ingestion?", default_yes=True
    )

    print(f"\nJobs prepared: {len(jobs)}")
    if not _prompt_yes_no(
        "Proceed with ingestion for all listed jobs?", default_yes=True
    ):
        print("Aborted by user.")
        return 0

    report = ingest_from_payload(
        payload={"jobs": jobs},
        db_path=db_path,
        dry_run=dry_run,
        refresh_cache=refresh_cache,
        config_base=PROJECT_ROOT,
    )

    output = {
        "db_path": report.db_path,
        "dry_run": report.dry_run,
        "total_students": report.total_students,
        "total_events": report.total_events,
        "jobs": [job.__dict__ for job in report.jobs],
    }
    print("\nIngestion complete:")
    print(json.dumps(output, indent=2))

    if _prompt_yes_no(
        "Save generated jobs as a reusable config file?", default_yes=True
    ):
        default_config_path = str(PROJECT_ROOT / f"ingestion_{pdf_path.stem}.json")
        config_path = Path(_prompt("Config output path", default_config_path))
        config_path.write_text(json.dumps({"jobs": jobs}, indent=2), encoding="utf-8")
        print(f"Saved config: {config_path}")

    return 0


def main() -> int:
    try:
        return run_interactive()
    except Exception as exc:
        print(f"Error: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
