from __future__ import annotations

import argparse
import json

from backend.db import SQLiteResultRepository
from backend.pdf_ingestion import _build_single_job_payload, ingest_from_config, main


def _write_config(tmp_path, payload: dict) -> str:
    file_path = tmp_path / "ingest_config.json"
    file_path.write_text(json.dumps(payload), encoding="utf-8")
    return str(file_path)


def test_full_ingestion_job_inserts_events(monkeypatch, tmp_path):
    extracted_rows = [
        {
            "regno": "812823205001",
            "name": "Student One",
            "subjects": {
                "CS3591": "U",
                "IT3501": "B+",
                "CCS334": "NA",
            },
        },
        {
            "regno": "812823205002",
            "name": "Student Two",
            "subjects": {
                "CS3591": "A",
                "IT3501": "UA",
            },
        },
    ]

    def fake_extract_results_from_file(**_kwargs):
        return extracted_rows

    monkeypatch.setattr(
        "backend.pdf_ingestion.extract_results_from_file",
        fake_extract_results_from_file,
    )

    pdf_path = tmp_path / "dummy.pdf"
    pdf_path.write_bytes(b"%PDF-1.0")

    config_path = _write_config(
        tmp_path,
        {
            "defaults": {
                "pdf_path": str(pdf_path),
                "exam_name": "ND2025",
                "result_date": "2025-12-20",
                "state": "PROVISIONAL",
            },
            "jobs": [
                {
                    "name": "full_it_sem5",
                    "mode": "full",
                    "semester": 5,
                    "department": "IT",
                    "batch": "2023",
                    "sem_name": "23-ODD",
                }
            ],
        },
    )

    db_path = tmp_path / "results.sqlite3"
    report = ingest_from_config(config_path=config_path, db_path=db_path)

    assert report.total_students == 2
    assert report.total_events == 4

    repo = SQLiteResultRepository(db_path)
    effective = repo.get_effective_grade_map(
        regno="812823205001",
        sem_no=5,
        sem_name="23-ODD",
    )
    assert effective["CS3591"] == "U"
    assert effective["IT3501"] == "B+"


def test_partial_ingestion_honors_regno_and_subject_filters(monkeypatch, tmp_path):
    extracted_rows = [
        {
            "regno": "812823205001",
            "name": "Student One",
            "subjects": {
                "CS3591": "A",
                "IT3501": "B",
            },
        },
        {
            "regno": "812823205002",
            "name": "Student Two",
            "subjects": {
                "CS3591": "U",
                "IT3501": "UA",
            },
        },
    ]

    def fake_extract_results_from_file(**_kwargs):
        return extracted_rows

    monkeypatch.setattr(
        "backend.pdf_ingestion.extract_results_from_file",
        fake_extract_results_from_file,
    )

    pdf_path = tmp_path / "dummy.pdf"
    pdf_path.write_bytes(b"%PDF-1.0")

    config_path = _write_config(
        tmp_path,
        {
            "defaults": {
                "pdf_path": str(pdf_path),
                "exam_name": "ND2025",
                "result_date": "2025-12-20",
                "state": "PROVISIONAL",
            },
            "jobs": [
                {
                    "name": "partial_only_one_student_one_subject",
                    "mode": "partial",
                    "semester": 5,
                    "department": "IT",
                    "batch": "2023",
                    "sem_name": "23-ODD",
                    "include_regnos": ["812823205001"],
                    "include_subject_codes": ["CS3591"],
                }
            ],
        },
    )

    db_path = tmp_path / "results.sqlite3"
    report = ingest_from_config(config_path=config_path, db_path=db_path)

    assert report.total_students == 1
    assert report.total_events == 1

    repo = SQLiteResultRepository(db_path)
    effective = repo.get_effective_grade_map(
        regno="812823205001",
        sem_no=5,
        sem_name="23-ODD",
    )
    assert effective == {"CS3591": "A"}


def test_partial_reval_nc_is_saved_but_does_not_override(monkeypatch, tmp_path):
    first_rows = [
        {
            "regno": "812823205001",
            "name": "Student One",
            "subjects": {
                "CS3591": "U",
            },
        }
    ]
    second_rows = [
        {
            "regno": "812823205001",
            "name": "Student One",
            "subjects": {
                "CS3591": "NC",
            },
        }
    ]
    calls = [first_rows, second_rows]

    def fake_extract_results_from_file(**_kwargs):
        return calls.pop(0)

    monkeypatch.setattr(
        "backend.pdf_ingestion.extract_results_from_file",
        fake_extract_results_from_file,
    )

    pdf_path = tmp_path / "dummy.pdf"
    pdf_path.write_bytes(b"%PDF-1.0")

    config_path = _write_config(
        tmp_path,
        {
            "defaults": {
                "pdf_path": str(pdf_path),
                "exam_name": "ESE",
            },
            "jobs": [
                {
                    "name": "provisional_full",
                    "mode": "full",
                    "semester": 5,
                    "department": "IT",
                    "batch": "2023",
                    "sem_name": "23-ODD",
                    "state": "PROVISIONAL",
                    "result_date": "2025-05-01",
                },
                {
                    "name": "reval_partial",
                    "mode": "partial",
                    "semester": 5,
                    "department": "IT",
                    "batch": "2023",
                    "sem_name": "23-ODD",
                    "state": "REVAL",
                    "result_date": "2025-06-01",
                    "include_regnos": ["812823205001"],
                    "include_subject_codes": ["CS3591"],
                },
            ],
        },
    )

    db_path = tmp_path / "results.sqlite3"
    report = ingest_from_config(config_path=config_path, db_path=db_path)

    assert report.total_students == 2
    assert report.total_events == 2

    repo = SQLiteResultRepository(db_path)
    effective = repo.get_effective_results(
        regno="812823205001",
        sem_no=5,
        sem_name="23-ODD",
    )

    assert len(effective) == 1
    assert effective[0]["grade"] == "U"
    assert effective[0]["had_nc_events"] == 1


def test_build_single_job_payload_parses_csv_fields():
    args = argparse.Namespace(
        mode="partial",
        pdf_path="205_ND2025.pdf",
        semester=5,
        department="IT",
        batch="2023",
        sem_name="23-ODD",
        state="REVAL",
        exam_name="ND2025_R",
        result_date="2025-06-01",
        job_name="cli_partial",
        regno_slug=None,
        include_regnos="812823205001, 812823205002",
        exclude_regnos="812823205003",
        include_subject_codes="cs3591, it3501",
        limit_students=10,
        strict_grades=True,
        debug=False,
        expand_with_effective_subjects=None,
    )

    payload = _build_single_job_payload(args)
    job = payload["jobs"][0]

    assert job["mode"] == "partial"
    assert job["include_regnos"] == ["812823205001", "812823205002"]
    assert job["exclude_regnos"] == ["812823205003"]
    assert job["include_subject_codes"] == ["CS3591", "IT3501"]
    assert job["strict_grades"] is True
    assert job["limit_students"] == 10


def test_reval_full_mode_can_carry_forward_missing_subjects(monkeypatch, tmp_path):
    first_rows = [
        {
            "regno": "812823205001",
            "name": "Student One",
            "subjects": {
                "CS3591": "U",
                "IT3501": "B+",
            },
        }
    ]
    second_rows = [
        {
            "regno": "812823205001",
            "name": "Student One",
            "subjects": {
                "CS3591": "A",
            },
        }
    ]
    calls = [first_rows, second_rows]

    def fake_extract_results_from_file(**_kwargs):
        return calls.pop(0)

    monkeypatch.setattr(
        "backend.pdf_ingestion.extract_results_from_file",
        fake_extract_results_from_file,
    )

    pdf_path = tmp_path / "dummy.pdf"
    pdf_path.write_bytes(b"%PDF-1.0")

    config_path = _write_config(
        tmp_path,
        {
            "defaults": {
                "pdf_path": str(pdf_path),
                "semester": 5,
                "department": "IT",
                "batch": "2023",
                "sem_name": "23-ODD",
            },
            "jobs": [
                {
                    "name": "baseline_provisional",
                    "mode": "full",
                    "state": "PROVISIONAL",
                    "exam_name": "ND2025",
                    "result_date": "2025-12-20",
                },
                {
                    "name": "full_reval_sparse",
                    "mode": "full",
                    "state": "REVAL",
                    "exam_name": "ND2025_R",
                    "result_date": "2026-01-10",
                    "expand_with_effective_subjects": True,
                },
            ],
        },
    )

    db_path = tmp_path / "results.sqlite3"
    report = ingest_from_config(config_path=config_path, db_path=db_path)

    assert report.total_events == 4
    assert report.jobs[1].carried_forward_events == 1

    repo = SQLiteResultRepository(db_path)
    effective = repo.get_effective_grade_map_for_semester(
        regno="812823205001",
        sem_no=5,
        department_code=205,
        batch="2023",
    )
    assert effective == {
        "CS3591": "A",
        "IT3501": "B+",
    }


def test_main_direct_cli_mode_runs_single_job(monkeypatch, tmp_path):
    extracted_rows = [
        {
            "regno": "812823205001",
            "name": "Student One",
            "subjects": {
                "CS3591": "A",
            },
        }
    ]

    def fake_extract_results_from_file(**_kwargs):
        return extracted_rows

    monkeypatch.setattr(
        "backend.pdf_ingestion.extract_results_from_file",
        fake_extract_results_from_file,
    )

    pdf_path = tmp_path / "dummy.pdf"
    pdf_path.write_bytes(b"%PDF-1.0")
    db_path = tmp_path / "results.sqlite3"

    exit_code = main(
        [
            "--mode",
            "full",
            "--pdf-path",
            str(pdf_path),
            "--semester",
            "5",
            "--department",
            "IT",
            "--batch",
            "2023",
            "--sem-name",
            "23-ODD",
            "--state",
            "PROVISIONAL",
            "--exam-name",
            "ND2025",
            "--result-date",
            "2025-12-20",
            "--db",
            str(db_path),
        ]
    )

    assert exit_code == 0

    repo = SQLiteResultRepository(db_path)
    effective = repo.get_effective_grade_map(
        regno="812823205001",
        sem_no=5,
        sem_name="23-ODD",
    )
    assert effective == {"CS3591": "A"}
