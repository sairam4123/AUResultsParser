from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from backend.constants import (
    RESULT_GRADES,
    RESULT_STATES,
    dept_codes,
    get_subjects_for_semester,
)
from backend.db import SQLiteResultRepository
from backend.parser import extract_results_from_file

GRADE_ALIASES = {
    "ABS": "UA",
    "ABSENT": "UA",
    "AB": "UA",
    "RA": "U",
}


@dataclass
class JobReport:
    job_name: str
    mode: str
    semester: int
    department_code: int
    batch: str
    sem_name: str
    state: str
    matched_students: int
    extracted_students: int
    inserted_events: int
    skipped_na_events: int
    skipped_invalid_events: int
    carried_forward_events: int
    sparse_rows_detected: int


@dataclass
class IngestionReport:
    db_path: str
    dry_run: bool
    jobs: list[JobReport]

    @property
    def total_students(self) -> int:
        return sum(item.matched_students for item in self.jobs)

    @property
    def total_events(self) -> int:
        return sum(item.inserted_events for item in self.jobs)


def ingest_from_config(
    *,
    config_path: str | Path,
    db_path: str | Path,
    dry_run: bool = False,
    refresh_cache: bool = False,
    debug: bool = False,
) -> IngestionReport:
    config_file = Path(config_path)
    payload = json.loads(config_file.read_text(encoding="utf-8"))

    return ingest_from_payload(
        payload=payload,
        db_path=db_path,
        dry_run=dry_run,
        refresh_cache=refresh_cache,
        config_base=config_file.parent,
        debug=debug,
    )


def ingest_from_payload(
    *,
    payload: dict[str, Any],
    db_path: str | Path,
    dry_run: bool = False,
    refresh_cache: bool = False,
    config_base: Path | None = None,
    debug: bool = False,
) -> IngestionReport:
    base_path = config_base or Path.cwd()

    defaults = payload.get("defaults", {})
    jobs = payload.get("jobs", [])
    if not isinstance(jobs, list) or not jobs:
        raise ValueError("Config must contain a non-empty 'jobs' array")

    repository = SQLiteResultRepository(db_path)
    if not dry_run:
        repository.initialize_schema()

    reports: list[JobReport] = []

    for idx, job_payload in enumerate(jobs, start=1):
        if not isinstance(job_payload, dict):
            raise ValueError(f"Job #{idx} must be an object")

        job = _resolve_job(
            idx=idx,
            defaults=defaults,
            job=job_payload,
            config_base=base_path,
        )
        job_debug = bool(debug or job["debug"])
        extracted = extract_results_from_file(
            recognized_subjects=job["recognized_subjects"],
            semester=job["semester"],
            file=job["pdf_path"],
            regno_slug=job["extract_regno_slug"],
            department_code=job["extract_department_code"],
        )
        extracted_rows = extracted or []
        filtered_rows = _apply_partial_filters(extracted_rows, job)

        recognized_count = len(job["recognized_subjects"])
        sparse_rows_detected = sum(
            1
            for row in filtered_rows
            if isinstance(row.get("subjects"), dict)
            and len(row.get("subjects", {})) < recognized_count
        )
        _debug_print(
            job_debug,
            (
                f"job={job['name']} state={job['state']} mode={job['mode']} "
                f"recognized_subjects={recognized_count} extracted_students={len(extracted_rows)} "
                f"filtered_students={len(filtered_rows)} sparse_rows={sparse_rows_detected}"
            ),
        )

        inserted_events = 0
        skipped_na_events = 0
        skipped_invalid_events = 0
        carried_forward_events = 0

        if not dry_run and filtered_rows:
            if job["expand_with_effective_subjects"]:
                filtered_rows, carried_forward_events = (
                    _expand_rows_with_effective_subjects(
                        rows=filtered_rows,
                        job=job,
                        repository=repository,
                        debug=job_debug,
                    )
                )

            exam_id = repository.insert_exam(
                name=job["exam_name"],
                result_date=job["result_date"],
                semester_no=job["semester"],
                department_code=job["department_code"],
                batch=job["batch"],
            )

            for row in filtered_rows:
                regno = str(row.get("regno", "")).strip()
                if not regno:
                    continue
                subjects = row.get("subjects")
                if not isinstance(subjects, dict):
                    continue

                for subject_code, raw_grade in subjects.items():
                    normalized_grade = _normalize_grade(raw_grade)
                    if normalized_grade is None:
                        skipped_na_events += 1
                        continue

                    if normalized_grade not in RESULT_GRADES:
                        skipped_invalid_events += 1
                        if job["strict_grades"]:
                            raise ValueError(
                                f"Unsupported grade '{raw_grade}' for {regno} {subject_code}"
                            )
                        continue

                    repository.insert_result_event(
                        exam_id=exam_id,
                        regno=regno,
                        student_name=str(row.get("name", "N/A")),
                        subject_code=str(subject_code),
                        sem_no=job["semester"],
                        sem_name=job["sem_name"],
                        state=job["state"],
                        grade=normalized_grade,
                    )
                    inserted_events += 1
        elif dry_run and filtered_rows and job["expand_with_effective_subjects"]:
            _debug_print(
                job_debug,
                (
                    f"job={job['name']} would expand missing reval subjects from effective grades, "
                    "but expansion is skipped in dry-run mode"
                ),
            )

        report = JobReport(
            job_name=job["name"],
            mode=job["mode"],
            semester=job["semester"],
            department_code=job["department_code"],
            batch=job["batch"],
            sem_name=job["sem_name"],
            state=job["state"],
            matched_students=len(filtered_rows),
            extracted_students=len(extracted_rows),
            inserted_events=inserted_events,
            skipped_na_events=skipped_na_events,
            skipped_invalid_events=skipped_invalid_events,
            carried_forward_events=carried_forward_events,
            sparse_rows_detected=sparse_rows_detected,
        )
        reports.append(report)

    if not dry_run and refresh_cache:
        repository.refresh_effective_grade_cache()

    return IngestionReport(
        db_path=str(Path(db_path)),
        dry_run=dry_run,
        jobs=reports,
    )


def _resolve_job(
    *,
    idx: int,
    defaults: dict[str, Any],
    job: dict[str, Any],
    config_base: Path,
) -> dict[str, Any]:
    def value(key: str, *, required: bool = False, fallback: Any = None) -> Any:
        if key in job:
            return job[key]
        if key in defaults:
            return defaults[key]
        if required:
            raise ValueError(f"Missing required field '{key}' for job #{idx}")
        return fallback

    mode = str(value("mode", fallback="full")).strip().lower()
    if mode not in {"full", "partial"}:
        raise ValueError(f"Invalid mode for job #{idx}: {mode}")

    semester = int(value("semester", required=True))
    department_code = _resolve_department_code(value("department", required=True))
    batch = _normalize_batch(str(value("batch", required=True)))
    sem_name = str(value("sem_name", required=True)).strip()

    state = str(value("state", required=True)).strip().upper()
    if state not in RESULT_STATES:
        raise ValueError(f"Invalid result state for job #{idx}: {state}")

    pdf_path_value = str(value("pdf_path", required=True)).strip()
    pdf_path = (
        (config_base / pdf_path_value).resolve()
        if not Path(pdf_path_value).is_absolute()
        else Path(pdf_path_value)
    )
    if not pdf_path.exists():
        raise ValueError(f"PDF not found for job #{idx}: {pdf_path}")

    exam_name = str(value("exam_name", required=True)).strip()
    result_date = str(value("result_date", required=True)).strip()
    strict_grades = bool(value("strict_grades", fallback=False))
    debug = bool(value("debug", fallback=False))

    expand_with_effective_subjects_raw = value(
        "expand_with_effective_subjects",
        fallback=None,
    )
    if expand_with_effective_subjects_raw is None:
        expand_with_effective_subjects = False
    else:
        expand_with_effective_subjects = bool(expand_with_effective_subjects_raw)

    include_regnos = _normalize_regno_list(value("include_regnos", fallback=[]))
    exclude_regnos = _normalize_regno_list(value("exclude_regnos", fallback=[]))
    include_subject_codes = _normalize_subject_code_list(
        value("include_subject_codes", fallback=[])
    )
    limit_students = value("limit_students", fallback=None)
    limit_students = int(limit_students) if limit_students is not None else None

    explicit_slug = value("regno_slug", fallback=None)
    extract_regno_slug = (
        str(explicit_slug).strip()
        if isinstance(explicit_slug, str) and explicit_slug.strip()
        else None
    )

    if mode == "full":
        # Full ingestion is scoped by batch when available.
        extract_regno_slug = extract_regno_slug or _build_batch_slug(
            batch, department_code
        )

    extract_department_code: int | None = None
    if extract_regno_slug:
        extract_department_code = None
    else:
        extract_department_code = department_code

    recognized_subjects = sorted(get_subjects_for_semester(semester))
    if include_subject_codes:
        include_set = set(include_subject_codes)
        recognized_subjects = [
            subject for subject in recognized_subjects if subject in include_set
        ]

    if not recognized_subjects:
        raise ValueError(
            f"No recognized subjects found for semester {semester} in job #{idx}"
        )

    return {
        "name": str(value("name", fallback=f"job_{idx}")).strip(),
        "mode": mode,
        "semester": semester,
        "department_code": department_code,
        "batch": batch,
        "sem_name": sem_name,
        "state": state,
        "pdf_path": str(pdf_path),
        "exam_name": exam_name,
        "result_date": result_date,
        "strict_grades": strict_grades,
        "debug": debug,
        "expand_with_effective_subjects": expand_with_effective_subjects,
        "recognized_subjects": recognized_subjects,
        "extract_regno_slug": extract_regno_slug,
        "extract_department_code": extract_department_code,
        "include_regnos": include_regnos,
        "exclude_regnos": exclude_regnos,
        "include_subject_codes": include_subject_codes,
        "limit_students": limit_students,
    }


def _expand_rows_with_effective_subjects(
    *,
    rows: list[dict[str, Any]],
    job: dict[str, Any],
    repository: SQLiteResultRepository,
    debug: bool,
) -> tuple[list[dict[str, Any]], int]:
    recognized_subjects = [
        str(item).strip().upper() for item in job["recognized_subjects"]
    ]
    carried_forward = 0
    output_rows: list[dict[str, Any]] = []

    for row in rows:
        regno = str(row.get("regno", "")).strip()
        subjects = row.get("subjects")
        if not regno or not isinstance(subjects, dict):
            output_rows.append(row)
            continue

        normalized_subjects = {
            str(code).strip().upper(): str(grade).strip().upper()
            for code, grade in subjects.items()
        }

        baseline_map = repository.get_effective_grade_map_for_semester(
            regno=regno,
            sem_no=int(job["semester"]),
            department_code=int(job["department_code"]),
            batch=str(job["batch"]),
        )

        missing_before = [
            code for code in recognized_subjects if code not in normalized_subjects
        ]
        filled_count = 0
        for subject_code in missing_before:
            prior_grade = baseline_map.get(subject_code)
            if prior_grade is None:
                continue
            normalized_subjects[subject_code] = prior_grade
            filled_count += 1

        carried_forward += filled_count
        _debug_print(
            debug,
            (
                f"job={job['name']} regno={regno} extracted_subjects={len(subjects)} "
                f"missing_before={len(missing_before)} carried_forward={filled_count}"
            ),
        )

        output_rows.append(
            {
                "regno": regno,
                "name": str(row.get("name", "N/A")).strip() or "N/A",
                "subjects": normalized_subjects,
            }
        )

    return output_rows, carried_forward


def _debug_print(enabled: bool, message: str):
    if enabled:
        print(f"[pdf-ingestion:debug] {message}")


def _apply_partial_filters(
    rows: list[dict[str, Any]], job: dict[str, Any]
) -> list[dict[str, Any]]:
    include_regnos = set(job["include_regnos"])
    exclude_regnos = set(job["exclude_regnos"])
    include_subject_codes = set(job["include_subject_codes"])
    limit_students = job["limit_students"]

    filtered: list[dict[str, Any]] = []

    for row in rows:
        regno = str(row.get("regno", "")).strip()
        if not regno:
            continue

        if include_regnos and regno not in include_regnos:
            continue
        if regno in exclude_regnos:
            continue

        subjects = row.get("subjects")
        if not isinstance(subjects, dict):
            continue

        next_subjects: dict[str, str] = {}
        for subject_code, grade in subjects.items():
            normalized_subject = str(subject_code).strip().upper()
            if (
                include_subject_codes
                and normalized_subject not in include_subject_codes
            ):
                continue
            next_subjects[normalized_subject] = str(grade).strip().upper()

        if not next_subjects:
            continue

        filtered.append(
            {
                "regno": regno,
                "name": str(row.get("name", "N/A")).strip() or "N/A",
                "subjects": next_subjects,
            }
        )

        if limit_students is not None and len(filtered) >= limit_students:
            break

    return filtered


def _resolve_department_code(value: Any) -> int:
    text = str(value).strip().upper()
    if text in dept_codes:
        return int(dept_codes[text])

    if text.isdigit():
        numeric = int(text)
        if numeric in dept_codes.values():
            return numeric

    raise ValueError(f"Unsupported department value: {value}")


def _normalize_batch(value: str) -> str:
    candidate = value.strip()
    if not candidate.isdigit() or len(candidate) not in (2, 4):
        raise ValueError("batch must be 2 or 4 digit year (e.g. 23 or 2023)")
    return candidate if len(candidate) == 4 else f"20{candidate}"


def _build_batch_slug(batch: str, department_code: int) -> str:
    yy = batch[-2:]
    return f"8128{yy}{department_code}"


def _normalize_grade(value: Any) -> str | None:
    raw = str(value).strip().upper()
    if not raw or raw == "NA":
        return None
    return GRADE_ALIASES.get(raw, raw)


def _normalize_regno_list(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    return [str(item).strip() for item in values if str(item).strip()]


def _normalize_subject_code_list(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    return [str(item).strip().upper() for item in values if str(item).strip()]


def _csv_to_list(value: str | None, *, upper: bool = False) -> list[str]:
    if not value:
        return []

    entries = [item.strip() for item in value.split(",") if item.strip()]
    if upper:
        return [entry.upper() for entry in entries]
    return entries


def _build_single_job_payload(args: argparse.Namespace) -> dict[str, Any]:
    if not args.pdf_path:
        raise ValueError("--pdf-path is required in direct command-line mode")
    if args.semester is None:
        raise ValueError("--semester is required in direct command-line mode")
    if not args.department:
        raise ValueError("--department is required in direct command-line mode")
    if not args.batch:
        raise ValueError("--batch is required in direct command-line mode")
    if not args.sem_name:
        raise ValueError("--sem-name is required in direct command-line mode")
    if not args.exam_name:
        raise ValueError("--exam-name is required in direct command-line mode")
    if not args.result_date:
        raise ValueError("--result-date is required in direct command-line mode")

    job: dict[str, Any] = {
        "name": args.job_name or "cli_job",
        "mode": args.mode,
        "pdf_path": args.pdf_path,
        "semester": int(args.semester),
        "department": args.department,
        "batch": args.batch,
        "sem_name": args.sem_name,
        "state": args.state,
        "exam_name": args.exam_name,
        "result_date": args.result_date,
        "strict_grades": args.strict_grades,
        "debug": args.debug,
        "expand_with_effective_subjects": args.expand_with_effective_subjects,
    }

    if args.regno_slug:
        job["regno_slug"] = args.regno_slug

    include_regnos = _csv_to_list(args.include_regnos, upper=False)
    exclude_regnos = _csv_to_list(args.exclude_regnos, upper=False)
    include_subject_codes = _csv_to_list(args.include_subject_codes, upper=True)

    if include_regnos:
        job["include_regnos"] = include_regnos
    if exclude_regnos:
        job["exclude_regnos"] = exclude_regnos
    if include_subject_codes:
        job["include_subject_codes"] = include_subject_codes
    if args.limit_students is not None:
        job["limit_students"] = int(args.limit_students)

    return {"jobs": [job]}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Ingest AU result PDF into SQLite. Use --config for job files "
            "or pass direct CLI options for a single job."
        ),
    )
    parser.add_argument("--config", help="Path to ingestion JSON config")
    parser.add_argument(
        "--db",
        default="results.sqlite",
        help="Target SQLite database path",
    )
    parser.add_argument(
        "--mode",
        choices=["full", "partial"],
        default="full",
        help="Ingestion mode when using direct CLI options",
    )
    parser.add_argument("--pdf-path", help="Path to source PDF for direct CLI mode")
    parser.add_argument(
        "--semester", type=int, help="Semester number for direct CLI mode"
    )
    parser.add_argument("--department", help="Department name/code, e.g. IT or 205")
    parser.add_argument("--batch", help="Batch year, e.g. 2023 or 23")
    parser.add_argument("--sem-name", help="Semester name label, e.g. 23-ODD")
    parser.add_argument(
        "--state",
        choices=list(RESULT_STATES),
        default="PROVISIONAL",
        help="Result state for inserted events",
    )
    parser.add_argument("--exam-name", help="Exam name, e.g. ND2025")
    parser.add_argument(
        "--result-date", help="Result date in ISO format, e.g. 2025-12-20"
    )
    parser.add_argument("--job-name", help="Optional label for direct CLI mode")
    parser.add_argument(
        "--regno-slug", help="Optional regno slug override for extraction"
    )
    parser.add_argument(
        "--include-regnos",
        help="Comma-separated regnos to include (partial mode)",
    )
    parser.add_argument(
        "--exclude-regnos",
        help="Comma-separated regnos to exclude (partial mode)",
    )
    parser.add_argument(
        "--include-subject-codes",
        help="Comma-separated subject codes to include (partial mode)",
    )
    parser.add_argument(
        "--limit-students",
        type=int,
        help="Optional max matched students (partial mode)",
    )
    parser.add_argument(
        "--strict-grades",
        action="store_true",
        help="Fail on unknown grades instead of skipping",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and filter rows without writing to database",
    )
    parser.add_argument(
        "--refresh-cache",
        action="store_true",
        help="Refresh EffectiveGradeCache after ingestion",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Print verbose ingestion diagnostics",
    )
    parser.add_argument(
        "--expand-with-effective-subjects",
        action=argparse.BooleanOptionalAction,
        default=None,
        help=(
            "For sparse result PDFs (typically REVAL/CHALLENGE), carry forward missing "
            "subjects from existing effective grades"
        ),
    )

    args = parser.parse_args(argv)

    if args.config:
        report = ingest_from_config(
            config_path=args.config,
            db_path=args.db,
            dry_run=args.dry_run,
            refresh_cache=args.refresh_cache,
            debug=args.debug,
        )
    else:
        payload = _build_single_job_payload(args)
        report = ingest_from_payload(
            payload=payload,
            db_path=args.db,
            dry_run=args.dry_run,
            refresh_cache=args.refresh_cache,
            config_base=Path.cwd(),
            debug=args.debug,
        )

    payload = {
        "db_path": report.db_path,
        "dry_run": report.dry_run,
        "total_students": report.total_students,
        "total_events": report.total_events,
        "jobs": [item.__dict__ for item in report.jobs],
    }
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
