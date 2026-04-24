from __future__ import annotations

from pathlib import Path

from backend.interactive_pdf_ingestion import (
    _derive_exam_name_default,
    _infer_state_default_from_filename,
    _select_suggested_result_date,
    build_default_jobs,
    derive_sem_name,
)


def test_derive_sem_name_from_nd_exam_cycle():
    sem_name = derive_sem_name(
        pdf_path=Path("205_ND2025.pdf"),
        exam_name="ND2025",
        result_date="2026-01-20",
    )
    assert sem_name == "25-ODD"


def test_derive_sem_name_from_am_exam_cycle_supports_yyyy_format():
    sem_name = derive_sem_name(
        pdf_path=Path("205_AM2025_R.pdf"),
        exam_name="AM2025",
        result_date="2025-06-01",
        year_format="yyyy",
    )
    assert sem_name == "2025-EVEN"


def test_build_default_jobs_creates_full_ingest_plan_for_all_found_sem_batches():
    scan_payload = {
        "semesters": [3, 5],
        "batches_by_semester": {
            "3": ["2023", "2024"],
            "5": ["2023"],
        },
    }

    jobs = build_default_jobs(
        scan_payload,
        pdf_path=Path("205_ND2025.pdf"),
        department="205",
        state="PROVISIONAL",
        exam_name="ND2025",
        result_date="2025-12-20",
    )

    assert len(jobs) == 3
    assert all(job["mode"] == "full" for job in jobs)

    keyed = {(job["batch"], job["semester"]): job["sem_name"] for job in jobs}
    assert keyed[("2023", 5)] == "25-ODD"
    assert keyed[("2024", 3)] == "25-ODD"
    assert len({job["sem_name"] for job in jobs}) == 1


def test_build_default_jobs_respects_allowed_batches_limit():
    scan_payload = {
        "semesters": [3, 5],
        "batches_by_semester": {
            "3": ["2023", "2024"],
            "5": ["2023", "2024"],
        },
    }

    jobs = build_default_jobs(
        scan_payload,
        pdf_path=Path("205_ND2025.pdf"),
        department="205",
        state="PROVISIONAL",
        exam_name="ND2025",
        result_date="2025-12-20",
        allowed_batches={"2024"},
    )

    assert len(jobs) == 2
    assert {job["batch"] for job in jobs} == {"2024"}


def test_build_default_jobs_respects_allowed_semesters_limit():
    scan_payload = {
        "semesters": [1, 2, 3],
        "batches_by_semester": {
            "1": ["2023"],
            "2": ["2023"],
            "3": ["2023"],
        },
    }

    jobs = build_default_jobs(
        scan_payload,
        pdf_path=Path("205_AM2024.pdf"),
        department="205",
        state="PROVISIONAL",
        exam_name="AM2024",
        result_date="2024-07-18",
        allowed_semesters={2},
    )

    assert len(jobs) == 1
    assert jobs[0]["semester"] == 2


def test_derive_exam_name_default_removes_reval_suffix():
    assert _derive_exam_name_default(Path("205_AM2025_R.pdf")) == "205_AM2025"
    assert _derive_exam_name_default(Path("205_AM2025_r.pdf")) == "205_AM2025"


def test_derive_exam_name_default_removes_challenge_suffix():
    assert _derive_exam_name_default(Path("205_ND2025_C.pdf")) == "205_ND2025"


def test_derive_exam_name_default_keeps_name_without_suffix():
    assert _derive_exam_name_default(Path("205_ND2025.pdf")) == "205_ND2025"


def test_infer_state_default_from_filename_uses_suffix():
    assert _infer_state_default_from_filename(Path("205_ND2025_R.pdf")) == "REVAL"
    assert (
        _infer_state_default_from_filename(Path("205_ND2025_C.pdf")) == "CHALLENGE"
    )
    assert (
        _infer_state_default_from_filename(Path("205_ND2025.pdf")) == "PROVISIONAL"
    )


def test_select_suggested_result_date_prefers_top_for_provisional():
    suggested, source = _select_suggested_result_date(
        {
            "top_result_date": "2023-07-11",
            "bottom_result_date": "2023-07-19",
        },
        "PROVISIONAL",
    )

    assert suggested == "2023-07-11"
    assert source == "top"


def test_select_suggested_result_date_prefers_bottom_for_reval_or_challenge():
    payload = {
        "top_result_date": "2023-07-11",
        "bottom_result_date": "2023-07-19",
    }

    reval_suggested, reval_source = _select_suggested_result_date(payload, "REVAL")
    challenge_suggested, challenge_source = _select_suggested_result_date(
        payload,
        "CHALLENGE",
    )

    assert reval_suggested == "2023-07-19"
    assert reval_source == "bottom"
    assert challenge_suggested == "2023-07-19"
    assert challenge_source == "bottom"


def test_select_suggested_result_date_falls_back_to_top_for_reval_without_bottom():
    suggested, source = _select_suggested_result_date(
        {
            "top_result_date": "2023-07-11",
            "bottom_result_date": None,
        },
        "REVAL",
    )

    assert suggested == "2023-07-11"
    assert source == "top"
