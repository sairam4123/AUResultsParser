from pathlib import Path
import json
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
from backend.parser import (
    compare_results_students,
    extract_results_from_file,
    generate_rank_list,
    get_arrear_students,
    get_sem_result_summary,
    get_student_results,
    get_subject_wise_summary,
    load_results,
    store_results,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
STORAGE_CONFIG_FILE = PROJECT_ROOT / ".auresults_storage.json"


class StorageFolderPayload(BaseModel):
    folder: str


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


def load_semester_results(semester: int, department: str):
    _, dept_code = resolve_department(department)
    result_file = PROJECT_ROOT / f"semester_{semester}_results_{dept_code}.json"
    if not result_file.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Result file not found for semester {semester}, department {department}.",
        )
    return load_results(str(result_file)), dept_code, result_file.name


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


def get_output_result_file(semester: int, dept_code: int) -> Path:
    storage_folder = get_results_storage_folder()
    return storage_folder / f"semester_{semester}_results_{dept_code}.json"


@app.get("/")
def root():
    return {
        "service": "AU Results Parser API",
        "status": "ok",
        "docs": "/docs",
    }


@app.get("/api/meta")
def meta():
    semesters = sorted({sem for sem in subject_sem_mapping.values() if sem >= 3})
    return {
        "departments": [
            {"name": name, "code": code} for name, code in dept_codes.items()
        ],
        "semesters": semesters,
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
def semester_summary(semester: int, department: str):
    results, dept_code, filename = load_semester_results(semester, department)
    summary = get_sem_result_summary(results)
    return {
        "semester": semester,
        "department_code": dept_code,
        "source": filename,
        "summary": summary,
    }


@app.get("/api/student")
def student_result(semester: int, department: str, regno: str):
    results, dept_code, filename = load_semester_results(semester, department)
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

    return {
        "semester": semester,
        "department_code": dept_code,
        "source": filename,
        "student": {
            "regno": student.get("regno"),
            "name": student.get("name", "N/A"),
            "sgpa": round(sgpa, 2),
            "subjects": formatted_subjects,
        },
    }


@app.get("/api/students")
def students_directory(
    semester: int,
    department: str,
    q: str | None = Query(default=None, description="Search by regno or name"),
    limit: int = Query(default=2000, ge=1, le=5000),
):
    results, dept_code, filename = load_semester_results(semester, department)

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
    semester: int, department: str, top_k: int = Query(default=10, ge=1, le=200)
):
    results, dept_code, filename = load_semester_results(semester, department)
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
def compare_students(semester: int, department: str, regno1: str, regno2: str):
    results, dept_code, filename = load_semester_results(semester, department)
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


@app.get("/api/subject-summary")
def subject_summary(
    semester: int,
    department: str,
    regnos: str | None = Query(default=None, description="Comma separated regnos"),
):
    results, dept_code, filename = load_semester_results(semester, department)

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
    bucket: str | None = Query(default=None, pattern="^(1|2|3\\+)$"),
    exact_count: int | None = Query(default=None, ge=0, le=20),
):
    if bucket and exact_count is not None:
        raise HTTPException(
            status_code=400,
            detail="Provide either bucket or exact_count, not both.",
        )

    results, dept_code, filename = load_semester_results(semester, department)
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
    if normalized_batch:
        if not normalized_batch.isdigit() or len(normalized_batch) not in (2, 4):
            raise HTTPException(
                status_code=400,
                detail="Batch must be 2 or 4 digits, e.g. 25 or 2025.",
            )

        yy = normalized_batch[-2:]
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

    output_file = get_output_result_file(semester, dept_code)
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


@app.get("/api/export-json")
def export_semester_json(semester: int, department: str):
    results, dept_code, _ = load_semester_results(semester, department)
    filename = f"semester_{semester}_results_{dept_code}.json"
    payload = json.dumps(results, indent=2)

    return Response(
        content=payload,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
