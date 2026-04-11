from __future__ import annotations

from fastapi.testclient import TestClient

from backend import main as api_main
from backend.db import SQLiteResultRepository


def _seed_sqlite(db_path):
    repo = SQLiteResultRepository(db_path)
    repo.initialize_schema()

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
    repo.insert_result_event(
        exam_id=exam_id,
        regno="812823205002",
        student_name="Student Two",
        subject_code="CS3591",
        sem_no=5,
        sem_name="25-ODD",
        state="PROVISIONAL",
        grade="U",
    )


def test_v2_summary_uses_sqlite_not_json(monkeypatch, tmp_path):
    db_path = tmp_path / "results.sqlite"
    _seed_sqlite(db_path)

    monkeypatch.setenv("AU_RESULTS_DB_PATH", str(db_path))
    api_main._sqlite_repo = None
    api_main._sqlite_repo_path = None

    def should_not_be_called(*_args, **_kwargs):
        raise AssertionError("JSON loader must not be used by /api/v2")

    monkeypatch.setattr(api_main, "load_semester_results", should_not_be_called)

    client = TestClient(api_main.app)
    response = client.get(
        "/api/v2/summary",
        params={"semester": 5, "department": "IT", "batch": "2023"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["source"].startswith("sqlite:")
    assert payload["summary"]["appeared"] == 2


def test_v1_summary_path_uses_legacy_json_route(monkeypatch):
    def fake_json_loader(semester: int, department: str, batch: str | None = None):
        assert semester == 5
        assert department == "IT"
        assert batch == "2023"
        return (
            [
                {
                    "regno": "812823205001",
                    "name": "Legacy Student",
                    "subjects": {"CS3591": "A"},
                }
            ],
            205,
            "legacy_source.json",
        )

    monkeypatch.setattr(api_main, "load_semester_results", fake_json_loader)

    client = TestClient(api_main.app)
    response = client.get(
        "/api/v1/summary",
        params={"semester": 5, "department": "IT", "batch": "2023"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["source"] == "legacy_source.json"
    assert payload["summary"]["appeared"] == 1


def test_v2_student_audit_exposes_events_and_effective_subjects(monkeypatch, tmp_path):
    db_path = tmp_path / "results.sqlite"
    repo = SQLiteResultRepository(db_path)
    repo.initialize_schema()

    exam_prov = repo.insert_exam(
        name="AM2024",
        result_date="2024-07-18",
        semester_no=2,
        department_code=205,
        batch="2023",
    )
    repo.insert_result_event(
        exam_id=exam_prov,
        regno="812823205007",
        student_name="Sample Student",
        subject_code="CS3251",
        sem_no=2,
        sem_name="24-EVEN",
        state="PROVISIONAL",
        grade="U",
    )

    exam_reval = repo.insert_exam(
        name="AM2024_R",
        result_date="2024-08-10",
        semester_no=2,
        department_code=205,
        batch="2023",
    )
    repo.insert_result_event(
        exam_id=exam_reval,
        regno="812823205007",
        student_name="Sample Student",
        subject_code="CS3251",
        sem_no=2,
        sem_name="24-EVEN",
        state="REVAL",
        grade="B",
    )

    monkeypatch.setenv("AU_RESULTS_DB_PATH", str(db_path))
    api_main._sqlite_repo = None
    api_main._sqlite_repo_path = None

    client = TestClient(api_main.app)
    response = client.get(
        "/api/v2/student-audit",
        params={
            "semester": 2,
            "department": "IT",
            "batch": "2023",
            "regno": "812823205007",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["events"]) == 2
    assert any(item["state"] == "REVAL" and item["grade"] == "B" for item in payload["events"])
    assert any(item["code"] == "CS3251" and item["grade"] == "B" for item in payload["effective_subjects"])
