from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from backend.parser import extract_results_from_file


@dataclass
class FakePage:
    text: str
    table: list[list[Any]] | None
    page_number: int

    def extract_text(self):
        return self.text

    def extract_table(self):
        return self.table


class FakePdf:
    def __init__(self, pages: list[FakePage]):
        self.pages = pages

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return None


def test_extract_results_uses_each_table_header_and_merges_subjects(monkeypatch):
    pages = [
        FakePage(
            text="Semester No. : 01\n812823205001",
            table=[
                ["Reg Number", "Student Name", "GE3151", "MA3151"],
                ["812823205001", "STUDENT ONE", "B", "C"],
            ],
            page_number=1,
        ),
        FakePage(
            text="812823205001",
            table=[
                ["Reg Number", "Student Name", "GE3171", "GE3172"],
                ["812823205001", "STUDENT ONE", "O", "A+"],
            ],
            page_number=2,
        ),
    ]

    monkeypatch.setattr("backend.parser.pdfplumber.open", lambda _file: FakePdf(pages))

    payload = extract_results_from_file(
        recognized_subjects=["GE3151", "MA3151", "GE3171", "GE3172", "HS3152"],
        semester=1,
        file="dummy.pdf",
        regno_slug="812823205",
        department_code=None,
    )

    assert payload is not None
    assert len(payload) == 1
    assert payload[0]["subjects"] == {
        "GE3151": "B",
        "MA3151": "C",
        "GE3171": "O",
        "GE3172": "A+",
    }


def test_extract_results_duplicate_subject_uses_last_occurrence(monkeypatch):
    pages = [
        FakePage(
            text="Semester No. : 01\n812823205001",
            table=[
                ["Reg Number", "Student Name", "GE3151"],
                ["812823205001", "STUDENT ONE", "B"],
            ],
            page_number=1,
        ),
        FakePage(
            text="812823205001",
            table=[
                ["Reg Number", "Student Name", "GE3151"],
                ["812823205001", "STUDENT ONE", "A"],
            ],
            page_number=2,
        ),
    ]

    monkeypatch.setattr("backend.parser.pdfplumber.open", lambda _file: FakePdf(pages))

    payload = extract_results_from_file(
        recognized_subjects=["GE3151"],
        semester=1,
        file="dummy.pdf",
        regno_slug="812823205",
        department_code=None,
    )

    assert payload is not None
    assert payload[0]["subjects"]["GE3151"] == "A"


def test_extract_results_handles_multi_row_header_and_continuation_page(monkeypatch):
    pages = [
        FakePage(
            text="Semester No. : 01\n812823205001",
            table=[
                ["", "Subject Code - >", "GE3151", "MA3151"],
                ["Reg. Number", "Stud. Name", "Grade", "Grade"],
                ["812823205001", "STUDENT ONE", "B", "C"],
            ],
            page_number=1,
        ),
        FakePage(
            text="812823205002",
            table=[
                ["812823205002", "STUDENT TWO", "A", "B+"],
            ],
            page_number=2,
        ),
    ]

    monkeypatch.setattr("backend.parser.pdfplumber.open", lambda _file: FakePdf(pages))

    payload = extract_results_from_file(
        recognized_subjects=["GE3151", "MA3151"],
        semester=1,
        file="dummy.pdf",
        regno_slug="812823205",
        department_code=None,
    )

    assert payload is not None
    assert len(payload) == 2
    assert payload[0]["regno"] == "812823205001"
    assert payload[0]["subjects"] == {"GE3151": "B", "MA3151": "C"}
    assert payload[1]["regno"] == "812823205002"
    assert payload[1]["subjects"] == {"GE3151": "A", "MA3151": "B+"}


def test_extract_results_stops_at_next_semester_block(monkeypatch):
    pages = [
        FakePage(
            text="Semester No. : 01\n812823205001",
            table=[
                ["", "Subject Code - >", "GE3151", "MA3151"],
                ["Reg. Number", "Stud. Name", "Grade", "Grade"],
                ["812823205001", "STUDENT ONE", "B", "C"],
            ],
            page_number=1,
        ),
        FakePage(
            text="Semester No. : 02\n812823205001",
            table=[
                ["", "Subject Code - >", "GE3251", "PH3256"],
                ["Reg. Number", "Stud. Name", "Grade", "Grade"],
                ["812823205001", "STUDENT ONE", "U", "U"],
            ],
            page_number=2,
        ),
    ]

    monkeypatch.setattr("backend.parser.pdfplumber.open", lambda _file: FakePdf(pages))

    payload = extract_results_from_file(
        recognized_subjects=["GE3151", "MA3151"],
        semester=1,
        file="dummy.pdf",
        regno_slug="812823205",
        department_code=None,
    )

    assert payload is not None
    assert len(payload) == 1
    assert payload[0]["subjects"] == {"GE3151": "B", "MA3151": "C"}
