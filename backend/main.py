from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from backend.constants import (
    calculate_sgpa,
    dept_codes,
    get_subject_name,
    subject_sem_mapping,
)
from backend.parser import (
    compare_results_students,
    generate_rank_list,
    get_sem_result_summary,
    get_student_results,
    get_subject_wise_summary,
    load_results,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]

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
