from __future__ import annotations

import pytest

from backend.db import SQLiteResultRepository


@pytest.fixture
def repo(tmp_path):
    repository = SQLiteResultRepository(tmp_path / "results.db")
    repository.initialize_schema()
    return repository


def _insert_event(
    repo: SQLiteResultRepository,
    *,
    result_date: str,
    state: str,
    grade: str,
    subject_code: str = "CS3591",
    regno: str = "812823205001",
    sem_no: int = 5,
    sem_name: str = "23-ODD",
    exam_name: str = "ESE",
):
    exam_id = repo.insert_exam(
        name=exam_name,
        result_date=result_date,
        semester_no=sem_no,
        department_code=205,
        batch="2023",
    )
    return repo.insert_result_event(
        exam_id=exam_id,
        regno=regno,
        subject_code=subject_code,
        sem_no=sem_no,
        sem_name=sem_name,
        state=state,
        grade=grade,
    )


def test_scenario_1_reval_non_nc_overrides_fail(repo: SQLiteResultRepository):
    _insert_event(repo, result_date="2025-05-01", state="PROVISIONAL", grade="U")
    _insert_event(repo, result_date="2025-06-01", state="REVAL", grade="B+")

    effective = repo.get_effective_results(
        regno="812823205001", sem_no=5, sem_name="23-ODD"
    )

    assert len(effective) == 1
    assert effective[0]["grade"] == "B+"
    assert effective[0]["state"] == "REVAL"

    audit = repo.get_audit_events(
        regno="812823205001", sem_no=5, sem_name="23-ODD", subject_code="CS3591"
    )
    assert [row["grade"] for row in audit] == ["B+", "U"]


def test_scenario_2_reval_nc_is_audited_but_does_not_override(
    repo: SQLiteResultRepository,
):
    _insert_event(repo, result_date="2025-05-01", state="PROVISIONAL", grade="U")
    _insert_event(repo, result_date="2025-06-01", state="REVAL", grade="NC")

    effective = repo.get_effective_results(
        regno="812823205001", sem_no=5, sem_name="23-ODD"
    )

    assert len(effective) == 1
    assert effective[0]["grade"] == "U"
    assert effective[0]["state"] == "PROVISIONAL"
    assert effective[0]["had_nc_events"] == 1
    assert effective[0]["audit_event_count"] == 2


def test_scenario_3_challenge_nc_keeps_original_and_non_nc_overrides(
    repo: SQLiteResultRepository,
):
    # Chain A: challenge NC keeps the original non-NC grade
    _insert_event(
        repo,
        result_date="2025-05-01",
        state="PROVISIONAL",
        grade="U",
        subject_code="IT3501",
    )
    _insert_event(
        repo,
        result_date="2025-06-01",
        state="REVAL",
        grade="NC",
        subject_code="IT3501",
    )
    _insert_event(
        repo,
        result_date="2025-07-01",
        state="CHALLENGE",
        grade="NC",
        subject_code="IT3501",
    )

    chain_a = repo.get_effective_grade_map(
        regno="812823205001", sem_no=5, sem_name="23-ODD"
    )
    assert chain_a["IT3501"] == "U"

    # Chain B: challenge non-NC must become effective
    _insert_event(
        repo,
        result_date="2025-05-01",
        state="PROVISIONAL",
        grade="U",
        subject_code="CS3691",
    )
    _insert_event(
        repo,
        result_date="2025-06-01",
        state="REVAL",
        grade="NC",
        subject_code="CS3691",
    )
    _insert_event(
        repo,
        result_date="2025-07-01",
        state="CHALLENGE",
        grade="A",
        subject_code="CS3691",
    )

    chain_b = repo.get_effective_grade_map(
        regno="812823205001", sem_no=5, sem_name="23-ODD"
    )
    assert chain_b["CS3691"] == "A"


def test_scenario_4_later_ese_attempt_overrides_older_exam(
    repo: SQLiteResultRepository,
):
    _insert_event(repo, result_date="2025-05-01", state="PROVISIONAL", grade="U")
    _insert_event(repo, result_date="2025-11-15", state="PROVISIONAL", grade="B")

    effective = repo.get_effective_grade_map(
        regno="812823205001", sem_no=5, sem_name="23-ODD"
    )
    assert effective["CS3591"] == "B"


def test_same_date_tie_break_uses_latest_eser_id(repo: SQLiteResultRepository):
    first_id = _insert_event(
        repo, result_date="2025-06-01", state="PROVISIONAL", grade="A"
    )
    second_id = _insert_event(
        repo, result_date="2025-06-01", state="PROVISIONAL", grade="B+"
    )

    assert second_id > first_id

    effective = repo.get_effective_grade_map(
        regno="812823205001", sem_no=5, sem_name="23-ODD"
    )
    assert effective["CS3591"] == "B+"


def test_effective_cache_can_be_refreshed_from_view(repo: SQLiteResultRepository):
    _insert_event(repo, result_date="2025-05-01", state="PROVISIONAL", grade="U")
    _insert_event(repo, result_date="2025-06-01", state="REVAL", grade="NC")

    repo.refresh_effective_grade_cache()
    rows = repo.get_effective_results_from_cache(
        regno="812823205001", sem_no=5, sem_name="23-ODD"
    )

    assert len(rows) == 1
    assert rows[0]["grade"] == "U"
    assert rows[0]["had_nc_events"] == 1


def test_load_semester_effective_results_returns_student_name(
    repo: SQLiteResultRepository,
):
    exam_id = repo.insert_exam(
        name="ND2025",
        result_date="2025-12-20",
        semester_no=5,
        department_code=205,
        batch="2023",
    )
    repo.insert_result_event(
        exam_id=exam_id,
        regno="812823205001",
        student_name="Student One",
        subject_code="CS3591",
        sem_no=5,
        sem_name="25-ODD",
        state="PROVISIONAL",
        grade="A",
    )

    rows, batch, sem_name = repo.load_semester_effective_results(
        semester_no=5,
        department_code=205,
        batch="2023",
        sem_name="25-ODD",
    )

    assert batch == "2023"
    assert sem_name == "25-ODD"
    assert rows == [
        {
            "regno": "812823205001",
            "name": "Student One",
            "subjects": {"CS3591": "A"},
        }
    ]


def test_load_semester_effective_results_merges_subjects_across_sem_names(
    repo: SQLiteResultRepository,
):
    old_exam_id = repo.insert_exam(
        name="ND2023",
        result_date="2024-01-20",
        semester_no=1,
        department_code=205,
        batch="2023",
    )
    repo.insert_result_event(
        exam_id=old_exam_id,
        regno="812823205068",
        student_name="THOMAS P",
        subject_code="GE3171",
        sem_no=1,
        sem_name="23-ODD",
        state="PROVISIONAL",
        grade="O",
    )

    new_exam_id = repo.insert_exam(
        name="ND2025",
        result_date="2026-01-20",
        semester_no=1,
        department_code=205,
        batch="2023",
    )
    repo.insert_result_event(
        exam_id=new_exam_id,
        regno="812823205068",
        student_name="THOMAS P",
        subject_code="MA3151",
        sem_no=1,
        sem_name="25-ODD",
        state="PROVISIONAL",
        grade="B",
    )

    rows, batch, sem_name = repo.load_semester_effective_results(
        semester_no=1,
        department_code=205,
        batch="2023",
        sem_name=None,
    )

    assert batch == "2023"
    assert sem_name is None
    student = next(item for item in rows if item["regno"] == "812823205068")
    assert student["subjects"]["GE3171"] == "O"
    assert student["subjects"]["MA3151"] == "B"


def test_effective_grade_map_merges_provisional_and_reval_across_sem_name(
    repo: SQLiteResultRepository,
):
    exam_prov = repo.insert_exam(
        name="ND2023",
        result_date="2024-01-20",
        semester_no=1,
        department_code=205,
        batch="2023",
    )
    repo.insert_result_event(
        exam_id=exam_prov,
        regno="812823205068",
        student_name="THOMAS P",
        subject_code="GE3171",
        sem_no=1,
        sem_name="23-ODD",
        state="PROVISIONAL",
        grade="O",
    )

    exam_reval = repo.insert_exam(
        name="ND2025_R",
        result_date="2024-07-18",
        semester_no=1,
        department_code=205,
        batch="2023",
    )
    repo.insert_result_event(
        exam_id=exam_reval,
        regno="812823205068",
        student_name="THOMAS P",
        subject_code="MA3151",
        sem_no=1,
        sem_name="24-EVEN",
        state="REVAL",
        grade="B",
    )

    merged = repo.get_effective_grade_map(
        regno="812823205068",
        sem_no=1,
        sem_name="24-EVEN",
    )

    assert merged["GE3171"] == "O"
    assert merged["MA3151"] == "B"


def test_invalid_state_and_grade_are_rejected(repo: SQLiteResultRepository):
    exam_id = repo.insert_exam(
        name="ESE",
        result_date="2025-05-01",
        semester_no=5,
        department_code=205,
        batch="2023",
    )

    with pytest.raises(ValueError):
        repo.insert_result_event(
            exam_id=exam_id,
            regno="812823205001",
            subject_code="CS3591",
            sem_no=5,
            sem_name="23-ODD",
            state="INVALID",
            grade="U",
        )

    with pytest.raises(ValueError):
        repo.insert_result_event(
            exam_id=exam_id,
            regno="812823205001",
            subject_code="CS3591",
            sem_no=5,
            sem_name="23-ODD",
            state="PROVISIONAL",
            grade="INVALID",
        )
