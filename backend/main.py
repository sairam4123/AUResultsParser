from pathlib import Path
import json
import os
import tempfile

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.constants import (
    calculate_sgpa,
    dept_codes,
    get_subjects_for_semester,
    get_subject_name,
    subject_sem_mapping,
)
from backend.cgpa import (
    build_class_cgpa_payload,
    build_compare_breakdown_payload,
    build_student_breakdown_payload,
)
from backend.db import SQLiteResultRepository
from backend.parser import (
    compare_results_students,
    extract_results_from_file,
    generate_rank_list,
    get_arrear_students,
    get_sem_result_summary,
    get_student_results,
    get_subject_wise_summary,
    load_results,
    scan_result_pdf_structure,
    store_results,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
STORAGE_CONFIG_FILE = PROJECT_ROOT / ".auresults_storage.json"
DEFAULT_SQLITE_NAME = "results.sqlite"
LEGACY_SQLITE_NAME = "results.sqlite3"

_sqlite_repo: SQLiteResultRepository | None = None
_sqlite_repo_path: Path | None = None


class StorageFolderPayload(BaseModel):
    folder: str


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


def get_sqlite_repository() -> tuple[SQLiteResultRepository, Path]:
    global _sqlite_repo, _sqlite_repo_path

    db_path = resolve_sqlite_db_path()
    if _sqlite_repo is None or _sqlite_repo_path != db_path:
        repository = SQLiteResultRepository(db_path)
        repository.initialize_schema()
        _sqlite_repo = repository
        _sqlite_repo_path = db_path

    return _sqlite_repo, db_path


app = FastAPI(
    title="AU Results Parser API",
    version="1.0.0",
    description="API for AU result summaries, student lookup, comparison, and rankings.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def resolve_department(department: str) -> tuple[str, int]:
    value = department.strip().upper()
    if value in dept_codes:
        return value, dept_codes[value]

    if value.isdigit():
        code = int(value)
        for name, dep_code in dept_codes.items():
            if dep_code == code:
                return name, code

    raise HTTPException(
        status_code=400, detail="Invalid department. Use IT/AIML or code."
    )


def normalize_batch_for_filename(batch: str) -> str:
    value = batch.strip()
    if not value.isdigit() or len(value) not in (2, 4):
        raise HTTPException(
            status_code=400,
            detail="Batch must be 2 or 4 digits, e.g. 25 or 2025.",
        )

    return value if len(value) == 4 else f"20{value}"


def build_results_filename(batch: str, semester: int, dept_code: int) -> str:
    return f"{batch}_sem_{semester}_results_{dept_code}.json"


def infer_batch_from_regno(regno: str) -> str | None:
    digits = "".join(ch for ch in regno if ch.isdigit())
    if len(digits) < 6 or not digits.startswith("8128"):
        return None

    return f"20{digits[4:6]}"


def infer_batch_from_results(results: list[dict]) -> str | None:
    for item in results:
        regno = item.get("regno")
        if isinstance(regno, str):
            batch = infer_batch_from_regno(regno)
            if batch:
                return batch
    return None


def find_semester_result_file(
    semester: int,
    dept_code: int,
    batch: str | None = None,
) -> Path | None:
    storage_folder = get_results_storage_folder()

    if batch:
        normalized_batch = normalize_batch_for_filename(batch)
        batch_file = storage_folder / build_results_filename(
            normalized_batch, semester, dept_code
        )
        if batch_file.exists():
            return batch_file

    matched_files = sorted(
        storage_folder.glob(f"*_sem_{semester}_results_{dept_code}.json"),
        key=lambda file: file.name,
        reverse=True,
    )
    if matched_files:
        return matched_files[0]

    legacy_file = storage_folder / f"semester_{semester}_results_{dept_code}.json"
    if legacy_file.exists():
        return legacy_file

    return None


def load_semester_results(semester: int, department: str, batch: str | None = None):
    _, dept_code = resolve_department(department)
    result_file = find_semester_result_file(semester, dept_code, batch=batch)
    if not result_file:
        raise HTTPException(
            status_code=404,
            detail=(
                "Result file not found for semester "
                f"{semester}, department {department}"
                + (f", batch {batch}." if batch else ".")
            ),
        )
    return load_results(str(result_file)), dept_code, result_file.name


def parse_semesters_query(semesters: str) -> list[int]:
    parts = [part.strip() for part in semesters.split(",") if part.strip()]
    if not parts:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one semester, e.g. semesters=1,2,3",
        )

    parsed: set[int] = set()
    for value in parts:
        if not value.isdigit():
            raise HTTPException(
                status_code=400,
                detail=f"Invalid semester value '{value}'.",
            )

        semester = int(value)
        if not (1 <= semester <= 8):
            raise HTTPException(
                status_code=400,
                detail=f"Semester {semester} is out of allowed range 1-8.",
            )
        parsed.add(semester)

    return sorted(parsed)


def load_multiple_semester_results(
    semesters: list[int],
    department: str,
    batch: str | None,
) -> tuple[dict[int, list[dict]], int, dict[int, str]]:
    _department_name, dept_code = resolve_department(department)

    results_by_semester: dict[int, list[dict]] = {}
    sources: dict[int, str] = {}

    for semester in semesters:
        result_file = find_semester_result_file(semester, dept_code, batch=batch)
        if not result_file:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Result file not found for semester "
                    f"{semester}, department {department}"
                    + (f", batch {batch}." if batch else ".")
                ),
            )

        results_by_semester[semester] = load_results(str(result_file))
        sources[semester] = result_file.name

    return results_by_semester, dept_code, sources


def load_semester_results_v2(
    semester: int,
    department: str,
    batch: str | None = None,
) -> tuple[list[dict], int, str]:
    _department_name, dept_code = resolve_department(department)
    repository, db_path = get_sqlite_repository()

    normalized_batch = normalize_batch_for_filename(batch) if batch else None
    rows, resolved_batch, resolved_sem_name = (
        repository.load_semester_effective_results(
            semester_no=semester,
            department_code=dept_code,
            batch=normalized_batch,
            sem_name=None,
        )
    )

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=(
                "SQLite results not found for semester "
                f"{semester}, department {department}"
                + (f", batch {batch}." if batch else ".")
            ),
        )

    sem_label = resolved_sem_name or "ALL"
    source = f"sqlite:{db_path.name};batch={resolved_batch};sem_name={sem_label}"
    return rows, dept_code, source


def load_multiple_semester_results_v2(
    semesters: list[int],
    department: str,
    batch: str | None,
) -> tuple[dict[int, list[dict]], int, dict[int, str]]:
    _department_name, dept_code = resolve_department(department)
    repository, _db_path = get_sqlite_repository()
    normalized_batch = normalize_batch_for_filename(batch) if batch else None

    try:
        results_by_semester, sources = (
            repository.load_multiple_semester_effective_results(
                semesters=semesters,
                department_code=dept_code,
                batch=normalized_batch,
            )
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return results_by_semester, dept_code, sources


def get_results_storage_folder() -> Path:
    if STORAGE_CONFIG_FILE.exists():
        try:
            payload = json.loads(STORAGE_CONFIG_FILE.read_text(encoding="utf-8"))
            folder = payload.get("folder")
            if isinstance(folder, str) and folder.strip():
                target = Path(folder.strip())
                target.mkdir(parents=True, exist_ok=True)
                return target
        except (json.JSONDecodeError, OSError):
            pass

    PROJECT_ROOT.mkdir(parents=True, exist_ok=True)
    return PROJECT_ROOT


def get_available_batches() -> list[str]:
    storage_folder = get_results_storage_folder()
    batches: set[str] = set()

    for file in storage_folder.glob("*_sem_*_results_*.json"):
        batch = file.name.split("_", 1)[0]
        if len(batch) == 4 and batch.isdigit():
            batches.add(batch)

    return sorted(batches, reverse=True)


def set_results_storage_folder(folder: str) -> Path:
    target = Path(folder.strip())
    if not target.is_absolute():
        raise HTTPException(
            status_code=400,
            detail="Storage folder must be an absolute path on the server.",
        )

    try:
        target.mkdir(parents=True, exist_ok=True)
        STORAGE_CONFIG_FILE.write_text(
            json.dumps({"folder": str(target)}, indent=2),
            encoding="utf-8",
        )
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to set storage folder: {exc}",
        ) from exc

    return target


def get_output_result_file(batch: str, semester: int, dept_code: int) -> Path:
    storage_folder = get_results_storage_folder()
    return storage_folder / build_results_filename(batch, semester, dept_code)


@app.get("/")
def root():
    return {
        "service": "AU Results Parser API",
        "status": "ok",
        "docs": "/docs",
    }


@app.get("/api/meta")
def meta():
    semesters = sorted({sem for sem in subject_sem_mapping.values() if sem >= 1})
    return {
        "departments": [
            {"name": name, "code": code} for name, code in dept_codes.items()
        ],
        "semesters": semesters,
        "batches": get_available_batches(),
    }


@app.get("/api/storage-folder")
def get_storage_folder():
    folder = get_results_storage_folder()
    return {"folder": str(folder)}


@app.post("/api/storage-folder")
def update_storage_folder(payload: StorageFolderPayload):
    folder = payload.folder.strip()
    if not folder:
        raise HTTPException(status_code=400, detail="Folder path is required.")

    updated = set_results_storage_folder(folder)
    return {"folder": str(updated)}


@app.get("/api/summary")
def semester_summary(semester: int, department: str, batch: str | None = None):
    results, dept_code, filename = load_semester_results(semester, department, batch)
    summary = get_sem_result_summary(results)
    return {
        "semester": semester,
        "department_code": dept_code,
        "source": filename,
        "summary": summary,
    }


@app.get("/api/student")
def student_result(
    semester: int,
    department: str,
    regno: str,
    batch: str | None = None,
):
    results, dept_code, filename = load_semester_results(semester, department, batch)
    student = get_student_results(regno.strip(), results)
    if not student:
        raise HTTPException(
            status_code=404, detail="Student not found for selected semester."
        )

    subjects = student.get("subjects", {})
    if not isinstance(subjects, dict):
        raise HTTPException(
            status_code=500, detail="Malformed subject data for student."
        )

    formatted_subjects = [
        {
            "code": code,
            "name": get_subject_name(code),
            "grade": grade,
            "status": "Pass" if grade not in ["U", "UA"] else "Fail",
        }
        for code, grade in subjects.items()
    ]

    sgpa = calculate_sgpa(semester, subjects)
    arrears = sum(grade == "U" for grade in subjects.values())

    rank_items = generate_rank_list(results, semester, top_k=max(1, len(results)))
    student_regno = student.get("regno")
    rank = next(
        (
            item_rank
            for item_rank, item_regno, _item_name, _item_sgpa in rank_items
            if item_regno == student_regno
        ),
        None,
    )

    return {
        "semester": semester,
        "department_code": dept_code,
        "source": filename,
        "student": {
            "regno": student.get("regno"),
            "name": student.get("name", "N/A"),
            "sgpa": round(sgpa, 2),
            "rank": rank,
            "arrears": arrears,
            "subjects": formatted_subjects,
        },
    }


@app.get("/api/students")
def students_directory(
    semester: int,
    department: str,
    batch: str | None = None,
    q: str | None = Query(default=None, description="Search by regno or name"),
    limit: int = Query(default=2000, ge=1, le=5000),
):
    results, dept_code, filename = load_semester_results(semester, department, batch)

    query = q.strip().lower() if q else ""
    items: list[dict[str, str]] = []

    for result in results:
        regno = result.get("regno")
        name = result.get("name")
        if not isinstance(regno, str):
            continue

        safe_name = name if isinstance(name, str) else "N/A"
        haystack = f"{regno} {safe_name}".lower()
        if query and query not in haystack:
            continue

        items.append(
            {
                "regno": regno,
                "name": safe_name,
            }
        )

    items.sort(key=lambda item: item["regno"])
    limited_items = items[:limit]

    return {
        "semester": semester,
        "department_code": dept_code,
        "source": filename,
        "count": len(limited_items),
        "items": limited_items,
    }


@app.get("/api/rank-list")
def rank_list(
    semester: int,
    department: str,
    batch: str | None = None,
    top_k: int = Query(default=10, ge=1, le=200),
):
    results, dept_code, filename = load_semester_results(semester, department, batch)
    ranks = generate_rank_list(results, semester, top_k=top_k)
    payload = [
        {
            "rank": rank,
            "regno": regno,
            "name": name,
            "sgpa": sgpa,
        }
        for rank, regno, name, sgpa in ranks
    ]
    return {
        "semester": semester,
        "department_code": dept_code,
        "source": filename,
        "count": len(payload),
        "items": payload,
    }


@app.get("/api/compare")
def compare_students(
    semester: int,
    department: str,
    regno1: str,
    regno2: str,
    batch: str | None = None,
):
    results, dept_code, filename = load_semester_results(semester, department, batch)
    comparison = compare_results_students(
        regno1.strip(), regno2.strip(), results, semester
    )
    if not comparison:
        raise HTTPException(status_code=404, detail="Unable to compare students.")

    return {
        "semester": semester,
        "department_code": dept_code,
        "source": filename,
        "comparison": comparison,
    }


@app.get("/api/cgpa/class")
def cgpa_class(
    semesters: str,
    department: str,
    batch: str | None = None,
    regno: str | None = None,
    sort_by: str = Query(default="cgpa", pattern="^(cgpa|arrears|regno)$"),
    top: int | None = Query(default=None, ge=1, le=5000),
):
    semester_list = parse_semesters_query(semesters)
    results_by_semester, dept_code, sources = load_multiple_semester_results(
        semester_list,
        department,
        batch,
    )

    payload = build_class_cgpa_payload(
        results_by_semester,
        semester_list,
        regno_filter=regno.strip() if regno else None,
        sort_by=sort_by,
        top=top,
    )

    return {
        "department_code": dept_code,
        "semesters": semester_list,
        "sources": {str(key): value for key, value in sources.items()},
        **payload,
    }


@app.get("/api/cgpa/breakdown")
def cgpa_breakdown(
    semesters: str,
    department: str,
    regno: str,
    batch: str | None = None,
):
    semester_list = parse_semesters_query(semesters)
    results_by_semester, dept_code, sources = load_multiple_semester_results(
        semester_list,
        department,
        batch,
    )

    payload = build_student_breakdown_payload(results_by_semester, regno.strip())
    if payload is None:
        raise HTTPException(
            status_code=404,
            detail="Student not found in selected semesters.",
        )

    return {
        "department_code": dept_code,
        "requested_semesters": semester_list,
        "sources": {str(key): value for key, value in sources.items()},
        **payload,
    }


@app.get("/api/cgpa/compare")
def cgpa_compare(
    semesters: str,
    department: str,
    regno1: str,
    regno2: str,
    batch: str | None = None,
    subject_details: bool = Query(default=False),
):
    semester_list = parse_semesters_query(semesters)
    results_by_semester, dept_code, sources = load_multiple_semester_results(
        semester_list,
        department,
        batch,
    )

    payload = build_compare_breakdown_payload(
        results_by_semester,
        regno1.strip(),
        regno2.strip(),
        subject_details,
    )
    if payload is None:
        raise HTTPException(
            status_code=404,
            detail="One or both students not found in selected semesters.",
        )

    return {
        "department_code": dept_code,
        "semesters": semester_list,
        "sources": {str(key): value for key, value in sources.items()},
        **payload,
    }


@app.get("/api/subject-summary")
def subject_summary(
    semester: int,
    department: str,
    batch: str | None = None,
    regnos: str | None = Query(default=None, description="Comma separated regnos"),
):
    results, dept_code, filename = load_semester_results(semester, department, batch)

    regno_list = None
    if regnos:
        regno_list = [item.strip() for item in regnos.split(",") if item.strip()]

    summary, footer = get_subject_wise_summary(results, regno_list)
    summary_items = [
        {
            "code": code,
            "name": get_subject_name(code),
            **stats,
        }
        for code, stats in summary.items()
    ]

    return {
        "semester": semester,
        "department_code": dept_code,
        "source": filename,
        "subjects": summary_items,
        "footer": footer,
    }


@app.get("/api/arrears")
def arrears_summary(
    semester: int,
    department: str,
    batch: str | None = None,
    bucket: str | None = Query(default=None, pattern="^(1|2|3\\+)$"),
    exact_count: int | None = Query(default=None, ge=0, le=20),
):
    if bucket and exact_count is not None:
        raise HTTPException(
            status_code=400,
            detail="Provide either bucket or exact_count, not both.",
        )

    results, dept_code, filename = load_semester_results(semester, department, batch)
    counts, students = get_arrear_students(
        results,
        bucket=bucket,
        exact_count=exact_count,
    )

    return {
        "semester": semester,
        "department_code": dept_code,
        "source": filename,
        "counts": counts,
        "filter": {
            "bucket": bucket,
            "exact_count": exact_count,
        },
        "students": students,
    }


@app.post("/api/import-results")
async def import_results_file(
    semester: int = Form(..., ge=3, le=8),
    department: str = Form(...),
    regno_slug: str | None = Form(default=None),
    batch: str | None = Form(default=None),
    results_file: UploadFile = File(...),
):
    _, dept_code = resolve_department(department)

    normalized_slug = regno_slug.strip() if regno_slug and regno_slug.strip() else None
    normalized_batch = batch.strip() if batch and batch.strip() else None

    if normalized_slug and normalized_batch:
        raise HTTPException(
            status_code=400,
            detail="Provide either regno_slug or batch, not both.",
        )

    batch_slug = None
    filename_batch = None
    if normalized_batch:
        filename_batch = normalize_batch_for_filename(normalized_batch)
        yy = filename_batch[-2:]
        batch_slug = f"8128{yy}{dept_code}"

    effective_slug = normalized_slug or batch_slug

    if not results_file.filename:
        raise HTTPException(status_code=400, detail="Missing uploaded file name.")

    if not results_file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    recognized_subjects = sorted(get_subjects_for_semester(semester))
    if not recognized_subjects:
        raise HTTPException(
            status_code=400,
            detail=f"No recognized subjects configured for semester {semester}.",
        )

    uploaded_content = await results_file.read()
    if not uploaded_content:
        raise HTTPException(status_code=400, detail="Uploaded PDF is empty.")

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            tmp_file.write(uploaded_content)
            temp_path = Path(tmp_file.name)

        results = extract_results_from_file(
            recognized_subjects=recognized_subjects,
            semester=semester,
            file=str(temp_path),
            regno_slug=effective_slug,
            department_code=None if effective_slug else dept_code,
        )
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink()

    if not results:
        raise HTTPException(
            status_code=404,
            detail="No matching results found in the uploaded file for the selected semester and department.",
        )

    filename_batch = filename_batch or infer_batch_from_results(results)
    if not filename_batch:
        raise HTTPException(
            status_code=500,
            detail="Unable to infer batch from extracted results.",
        )

    output_file = get_output_result_file(filename_batch, semester, dept_code)
    store_results(results, str(output_file))

    return {
        "semester": semester,
        "department_code": dept_code,
        "source": results_file.filename,
        "output": output_file.name,
        "output_path": str(output_file),
        "filter": {
            "regno_slug": normalized_slug,
            "batch": normalized_batch,
            "effective_slug": effective_slug,
        },
        "count": len(results),
    }


@app.post("/api/import-results-preview")
async def import_results_preview(results_file: UploadFile = File(...)):
    if not results_file.filename:
        raise HTTPException(status_code=400, detail="Missing uploaded file name.")

    if not results_file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    uploaded_content = await results_file.read()
    if not uploaded_content:
        raise HTTPException(status_code=400, detail="Uploaded PDF is empty.")

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            tmp_file.write(uploaded_content)
            temp_path = Path(tmp_file.name)

        preview_payload = scan_result_pdf_structure(str(temp_path))
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink()

    return {
        "source": results_file.filename,
        **preview_payload,
    }


@app.get("/api/export-json")
def export_semester_json(semester: int, department: str, batch: str | None = None):
    results, _dept_code, source_filename = load_semester_results(
        semester, department, batch
    )
    filename = source_filename
    payload = json.dumps(results, indent=2)

    return Response(
        content=payload,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/v2/meta")
def meta_v2():
    repository, db_path = get_sqlite_repository()
    active_department_codes = set(repository.get_available_department_codes())
    departments = [
        {"name": name, "code": code}
        for name, code in dept_codes.items()
        if not active_department_codes or code in active_department_codes
    ]

    return {
        "source_of_truth": "sqlite",
        "db_path": str(db_path),
        "departments": departments,
        "semesters": repository.get_available_semesters(),
        "batches": repository.get_available_batches(),
    }


@app.get("/api/v2/summary")
def semester_summary_v2(semester: int, department: str, batch: str | None = None):
    results, dept_code, source = load_semester_results_v2(semester, department, batch)
    summary = get_sem_result_summary(results)
    return {
        "semester": semester,
        "department_code": dept_code,
        "source": source,
        "summary": summary,
    }


@app.get("/api/v2/student")
def student_result_v2(
    semester: int,
    department: str,
    regno: str,
    batch: str | None = None,
):
    results, dept_code, source = load_semester_results_v2(semester, department, batch)
    student = get_student_results(regno.strip(), results)
    if not student:
        raise HTTPException(
            status_code=404, detail="Student not found for selected semester."
        )

    subjects = student.get("subjects", {})
    if not isinstance(subjects, dict):
        raise HTTPException(
            status_code=500, detail="Malformed subject data for student."
        )

    formatted_subjects = [
        {
            "code": code,
            "name": get_subject_name(code),
            "grade": grade,
            "status": "Pass" if grade not in ["U", "UA"] else "Fail",
        }
        for code, grade in subjects.items()
    ]

    sgpa = calculate_sgpa(semester, subjects)
    arrears = sum(grade == "U" for grade in subjects.values())

    rank_items = generate_rank_list(results, semester, top_k=max(1, len(results)))
    student_regno = student.get("regno")
    rank = next(
        (
            item_rank
            for item_rank, item_regno, _item_name, _item_sgpa in rank_items
            if item_regno == student_regno
        ),
        None,
    )

    return {
        "semester": semester,
        "department_code": dept_code,
        "source": source,
        "student": {
            "regno": student.get("regno"),
            "name": student.get("name", "N/A"),
            "sgpa": round(sgpa, 2),
            "rank": rank,
            "arrears": arrears,
            "subjects": formatted_subjects,
        },
    }


@app.get("/api/v2/student-audit")
def student_audit_v2(
    semester: int,
    department: str,
    regno: str,
    batch: str | None = None,
):
    _department_name, dept_code = resolve_department(department)
    repository, db_path = get_sqlite_repository()

    normalized_batch = normalize_batch_for_filename(batch) if batch else None
    selected_batch = normalized_batch or repository.resolve_latest_batch(
        semester_no=semester,
        department_code=dept_code,
    )
    if not selected_batch:
        raise HTTPException(
            status_code=404,
            detail=(
                "SQLite audit data not found for semester "
                f"{semester}, department {department}"
                + (f", batch {batch}." if batch else ".")
            ),
        )

    events = repository.get_student_audit_for_semester(
        regno=regno.strip(),
        sem_no=semester,
        department_code=dept_code,
        batch=selected_batch,
    )
    if not events:
        raise HTTPException(
            status_code=404,
            detail="No audit events found for selected student.",
        )

    effective_map = repository.get_effective_grade_map_for_semester(
        regno=regno.strip(),
        sem_no=semester,
        department_code=dept_code,
        batch=selected_batch,
    )

    source = f"sqlite:{db_path.name};batch={selected_batch};sem_name=ALL"

    return {
        "semester": semester,
        "department_code": dept_code,
        "batch": selected_batch,
        "source": source,
        "regno": regno.strip(),
        "effective_subjects": [
            {
                "code": code,
                "name": get_subject_name(code),
                "grade": grade,
                "status": "Pass" if grade not in ["U", "UA"] else "Fail",
            }
            for code, grade in sorted(effective_map.items())
        ],
        "events": [
            {
                "exam_id": item["exam_id"],
                "exam_name": item["exam_name"],
                "result_date": item["result_date"],
                "subject_code": item["subjectCode"],
                "subject_name": get_subject_name(str(item["subjectCode"])),
                "sem_name": item["semName"],
                "state": item["state"],
                "grade": item["grade"],
                "recency_rank": item["recency_rank"],
            }
            for item in events
        ],
    }


@app.get("/api/v2/students")
def students_directory_v2(
    semester: int,
    department: str,
    batch: str | None = None,
    q: str | None = Query(default=None, description="Search by regno or name"),
    limit: int = Query(default=2000, ge=1, le=5000),
):
    results, dept_code, source = load_semester_results_v2(semester, department, batch)

    query = q.strip().lower() if q else ""
    items: list[dict[str, str]] = []

    for result in results:
        regno = result.get("regno")
        name = result.get("name")
        if not isinstance(regno, str):
            continue

        safe_name = name if isinstance(name, str) else "N/A"
        haystack = f"{regno} {safe_name}".lower()
        if query and query not in haystack:
            continue

        items.append(
            {
                "regno": regno,
                "name": safe_name,
            }
        )

    items.sort(key=lambda item: item["regno"])
    limited_items = items[:limit]

    return {
        "semester": semester,
        "department_code": dept_code,
        "source": source,
        "count": len(limited_items),
        "items": limited_items,
    }


@app.get("/api/v2/rank-list")
def rank_list_v2(
    semester: int,
    department: str,
    batch: str | None = None,
    top_k: int = Query(default=10, ge=1, le=200),
):
    results, dept_code, source = load_semester_results_v2(semester, department, batch)
    ranks = generate_rank_list(results, semester, top_k=top_k)
    payload = [
        {
            "rank": rank,
            "regno": regno,
            "name": name,
            "sgpa": sgpa,
        }
        for rank, regno, name, sgpa in ranks
    ]
    return {
        "semester": semester,
        "department_code": dept_code,
        "source": source,
        "count": len(payload),
        "items": payload,
    }


@app.get("/api/v2/compare")
def compare_students_v2(
    semester: int,
    department: str,
    regno1: str,
    regno2: str,
    batch: str | None = None,
):
    results, dept_code, source = load_semester_results_v2(semester, department, batch)
    comparison = compare_results_students(
        regno1.strip(), regno2.strip(), results, semester
    )
    if not comparison:
        raise HTTPException(status_code=404, detail="Unable to compare students.")

    return {
        "semester": semester,
        "department_code": dept_code,
        "source": source,
        "comparison": comparison,
    }


@app.get("/api/v2/cgpa/class")
def cgpa_class_v2(
    semesters: str,
    department: str,
    batch: str | None = None,
    regno: str | None = None,
    sort_by: str = Query(default="cgpa", pattern="^(cgpa|arrears|regno)$"),
    top: int | None = Query(default=None, ge=1, le=5000),
):
    semester_list = parse_semesters_query(semesters)
    results_by_semester, dept_code, sources = load_multiple_semester_results_v2(
        semester_list,
        department,
        batch,
    )

    payload = build_class_cgpa_payload(
        results_by_semester,
        semester_list,
        regno_filter=regno.strip() if regno else None,
        sort_by=sort_by,
        top=top,
    )

    return {
        "department_code": dept_code,
        "semesters": semester_list,
        "sources": {str(key): value for key, value in sources.items()},
        **payload,
    }


@app.get("/api/v2/cgpa/breakdown")
def cgpa_breakdown_v2(
    semesters: str,
    department: str,
    regno: str,
    batch: str | None = None,
):
    semester_list = parse_semesters_query(semesters)
    results_by_semester, dept_code, sources = load_multiple_semester_results_v2(
        semester_list,
        department,
        batch,
    )

    payload = build_student_breakdown_payload(results_by_semester, regno.strip())
    if payload is None:
        raise HTTPException(
            status_code=404,
            detail="Student not found in selected semesters.",
        )

    return {
        "department_code": dept_code,
        "requested_semesters": semester_list,
        "sources": {str(key): value for key, value in sources.items()},
        **payload,
    }


@app.get("/api/v2/cgpa/compare")
def cgpa_compare_v2(
    semesters: str,
    department: str,
    regno1: str,
    regno2: str,
    batch: str | None = None,
    subject_details: bool = Query(default=False),
):
    semester_list = parse_semesters_query(semesters)
    results_by_semester, dept_code, sources = load_multiple_semester_results_v2(
        semester_list,
        department,
        batch,
    )

    payload = build_compare_breakdown_payload(
        results_by_semester,
        regno1.strip(),
        regno2.strip(),
        subject_details,
    )
    if payload is None:
        raise HTTPException(
            status_code=404,
            detail="One or both students not found in selected semesters.",
        )

    return {
        "department_code": dept_code,
        "semesters": semester_list,
        "sources": {str(key): value for key, value in sources.items()},
        **payload,
    }


@app.get("/api/v2/subject-summary")
def subject_summary_v2(
    semester: int,
    department: str,
    batch: str | None = None,
    regnos: str | None = Query(default=None, description="Comma separated regnos"),
):
    results, dept_code, source = load_semester_results_v2(semester, department, batch)

    regno_list = None
    if regnos:
        regno_list = [item.strip() for item in regnos.split(",") if item.strip()]

    summary, footer = get_subject_wise_summary(results, regno_list)
    summary_items = [
        {
            "code": code,
            "name": get_subject_name(code),
            **stats,
        }
        for code, stats in summary.items()
    ]

    return {
        "semester": semester,
        "department_code": dept_code,
        "source": source,
        "subjects": summary_items,
        "footer": footer,
    }


@app.get("/api/v2/arrears")
def arrears_summary_v2(
    semester: int,
    department: str,
    batch: str | None = None,
    bucket: str | None = Query(default=None, pattern="^(1|2|3\\+)$"),
    exact_count: int | None = Query(default=None, ge=0, le=20),
):
    if bucket and exact_count is not None:
        raise HTTPException(
            status_code=400,
            detail="Provide either bucket or exact_count, not both.",
        )

    results, dept_code, source = load_semester_results_v2(semester, department, batch)
    counts, students = get_arrear_students(
        results,
        bucket=bucket,
        exact_count=exact_count,
    )

    return {
        "semester": semester,
        "department_code": dept_code,
        "source": source,
        "counts": counts,
        "filter": {
            "bucket": bucket,
            "exact_count": exact_count,
        },
        "students": students,
    }


@app.get("/api/v1/meta")
def meta_v1():
    return meta()


@app.get("/api/v1/storage-folder")
def get_storage_folder_v1():
    return get_storage_folder()


@app.post("/api/v1/storage-folder")
def update_storage_folder_v1(payload: StorageFolderPayload):
    return update_storage_folder(payload)


@app.get("/api/v1/summary")
def semester_summary_v1(semester: int, department: str, batch: str | None = None):
    return semester_summary(semester, department, batch)


@app.get("/api/v1/student")
def student_result_v1(
    semester: int,
    department: str,
    regno: str,
    batch: str | None = None,
):
    return student_result(semester, department, regno, batch)


@app.get("/api/v1/students")
def students_directory_v1(
    semester: int,
    department: str,
    batch: str | None = None,
    q: str | None = Query(default=None, description="Search by regno or name"),
    limit: int = Query(default=2000, ge=1, le=5000),
):
    return students_directory(semester, department, batch, q, limit)


@app.get("/api/v1/rank-list")
def rank_list_v1(
    semester: int,
    department: str,
    batch: str | None = None,
    top_k: int = Query(default=10, ge=1, le=200),
):
    return rank_list(semester, department, batch, top_k)


@app.get("/api/v1/compare")
def compare_students_v1(
    semester: int,
    department: str,
    regno1: str,
    regno2: str,
    batch: str | None = None,
):
    return compare_students(semester, department, regno1, regno2, batch)


@app.get("/api/v1/cgpa/class")
def cgpa_class_v1(
    semesters: str,
    department: str,
    batch: str | None = None,
    regno: str | None = None,
    sort_by: str = Query(default="cgpa", pattern="^(cgpa|arrears|regno)$"),
    top: int | None = Query(default=None, ge=1, le=5000),
):
    return cgpa_class(semesters, department, batch, regno, sort_by, top)


@app.get("/api/v1/cgpa/breakdown")
def cgpa_breakdown_v1(
    semesters: str,
    department: str,
    regno: str,
    batch: str | None = None,
):
    return cgpa_breakdown(semesters, department, regno, batch)


@app.get("/api/v1/cgpa/compare")
def cgpa_compare_v1(
    semesters: str,
    department: str,
    regno1: str,
    regno2: str,
    batch: str | None = None,
    subject_details: bool = Query(default=False),
):
    return cgpa_compare(
        semesters,
        department,
        regno1,
        regno2,
        batch,
        subject_details,
    )


@app.get("/api/v1/subject-summary")
def subject_summary_v1(
    semester: int,
    department: str,
    batch: str | None = None,
    regnos: str | None = Query(default=None, description="Comma separated regnos"),
):
    return subject_summary(semester, department, batch, regnos)


@app.get("/api/v1/arrears")
def arrears_summary_v1(
    semester: int,
    department: str,
    batch: str | None = None,
    bucket: str | None = Query(default=None, pattern="^(1|2|3\\+)$"),
    exact_count: int | None = Query(default=None, ge=0, le=20),
):
    return arrears_summary(semester, department, batch, bucket, exact_count)


@app.post("/api/v1/import-results")
async def import_results_file_v1(
    semester: int = Form(..., ge=3, le=8),
    department: str = Form(...),
    regno_slug: str | None = Form(default=None),
    batch: str | None = Form(default=None),
    results_file: UploadFile = File(...),
):
    return await import_results_file(
        semester=semester,
        department=department,
        regno_slug=regno_slug,
        batch=batch,
        results_file=results_file,
    )


@app.post("/api/v1/import-results-preview")
async def import_results_preview_v1(results_file: UploadFile = File(...)):
    return await import_results_preview(results_file)


@app.get("/api/v1/export-json")
def export_semester_json_v1(
    semester: int,
    department: str,
    batch: str | None = None,
):
    return export_semester_json(semester, department, batch)
