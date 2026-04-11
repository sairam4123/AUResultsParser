from __future__ import annotations

from backend.cgpa import (
    build_class_cgpa_payload,
    build_compare_breakdown_payload,
    build_student_breakdown_payload,
)


def _sample_results_by_semester() -> dict[int, list[dict[str, object]]]:
    return {
        5: [
            {
                "regno": "812823205001",
                "name": "Alice",
                "subjects": {
                    "CS3591": "C",
                    "CS3691": "C",
                    "IT3501": "B",
                },
            },
            {
                "regno": "812823205002",
                "name": "Bob",
                "subjects": {
                    "CS3591": "C",
                    "CS3691": "C",
                    "IT3501": "B",
                },
            },
            {
                "regno": "812823205003",
                "name": "Carol",
                "subjects": {
                    "CS3591": "U",
                    "CS3691": "O",
                    "IT3501": "B",
                },
            },
        ]
    }


def test_class_payload_cgpa_order_uses_arrears_then_regno() -> None:
    payload = build_class_cgpa_payload(
        _sample_results_by_semester(),
        semesters=[5],
        regno_filter=None,
        sort_by="cgpa",
        top=None,
    )

    rows = payload["rows"]
    ordered_regnos = [row["regno"] for row in rows]

    assert ordered_regnos == ["812823205001", "812823205002", "812823205003"]
    assert rows[0]["cgpa"] == rows[1]["cgpa"]
    assert rows[0]["arrears"] == 0
    assert rows[2]["arrears"] == 1


def test_student_breakdown_includes_detailed_calculation_fields() -> None:
    payload = build_student_breakdown_payload(
        {
            5: [
                {
                    "regno": "812823205060",
                    "name": "Detail Student",
                    "subjects": {
                        "CS3591": "A",
                        "CS3691": "U",
                        "MX3084": "O",  # non-credit -> not included
                        "IT3501": "NA",  # NA -> not included
                    },
                }
            ]
        },
        regno="812823205060",
    )

    assert payload is not None
    semester_payload = payload["semesters"][0]
    by_code = {item["code"]: item for item in semester_payload["subjects"]}

    assert by_code["CS3591"]["included"] is True
    assert by_code["CS3591"]["credit_x_gp"] == 32.0
    assert by_code["CS3691"]["included"] is True
    assert by_code["CS3691"]["credit_x_gp"] == 0.0
    assert by_code["MX3084"]["included"] is False
    assert by_code["IT3501"]["included"] is False

    totals = semester_payload["totals"]
    assert totals["credits"] == 8.0
    assert totals["grade_points"] == 32.0
    assert totals["sgpa"] == 4.0
    assert totals["arrears"] == 1


def test_compare_breakdown_supports_summary_and_subject_details() -> None:
    payload = build_compare_breakdown_payload(
        {
            5: [
                {
                    "regno": "812823205060",
                    "name": "Student One",
                    "subjects": {
                        "CS3591": "A",
                        "CS3691": "B+",
                    },
                },
                {
                    "regno": "812823205023",
                    "name": "Student Two",
                    "subjects": {
                        "CS3591": "B+",
                        "CS3691": "A",
                    },
                },
            ]
        },
        regno1="812823205060",
        regno2="812823205023",
        include_subject_details=True,
    )

    assert payload is not None
    assert payload["student1"]["regno"] == "812823205060"
    assert payload["student2"]["regno"] == "812823205023"

    metrics = [row["metric"] for row in payload["rows"]]
    assert metrics[-1] == "Overall"

    details = payload["subject_details"]
    assert len(details) == 1
    assert details[0]["semester"] == 5
    assert {row["code"] for row in details[0]["rows"]} == {"CS3591", "CS3691"}
