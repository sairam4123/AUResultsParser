import pdfplumber
import re

from backend.constants import calculate_sgpa, get_subject_name, grade_mapping

type Result = dict[str, str | dict[str, str]]

COLLEGE_CODE = "8128"
REGNO_BATCH_REGEX = re.compile(r"\d{4}(\d{2})\d{3}\d{3}")
SEMESTER_LINE_REGEX = re.compile(
    r"(Semester|Sem)\s+(No)?\.*\s*:\s*(?P<sem>\d+)",
    re.IGNORECASE,
)


def scan_result_pdf_structure(file: str) -> dict[str, object]:
    batches_by_sem: dict[int, set[str]] = {}
    pages_by_sem_batch: dict[tuple[int, str], set[int]] = {}

    with pdfplumber.open(file) as pdf:
        current_sem: int | None = None

        for page in pdf.pages:
            text = page.extract_text()
            if text:
                for line in text.split("\n"):
                    match = SEMESTER_LINE_REGEX.search(line)
                    if match:
                        current_sem = int(match.group("sem") or "0")

            table = page.extract_table()
            batches_found: set[str] = set()
            if table:
                for row in table:
                    if not row or len(row) == 0:
                        continue

                    first_cell = row[0]
                    if not first_cell:
                        continue

                    first_cell_text = str(first_cell)
                    if COLLEGE_CODE not in first_cell_text:
                        continue

                    batch_match = REGNO_BATCH_REGEX.search(first_cell_text)
                    if batch_match:
                        batch_year = f"20{batch_match.group(1)}"
                        batches_found.add(batch_year)

            if current_sem is not None:
                semester_batches = batches_by_sem.setdefault(current_sem, set())
                semester_batches.update(batches_found)

                for batch_year in batches_found:
                    key = (current_sem, batch_year)
                    pages_by_sem_batch.setdefault(key, set()).add(page.page_number)

    semesters_found = sorted(batches_by_sem.keys())
    batches_payload = {
        str(sem): sorted(list(batch_years))
        for sem, batch_years in sorted(batches_by_sem.items())
    }
    page_links_payload = [
        {
            "semester": sem,
            "batch": batch_year,
            "pages": sorted(list(page_numbers)),
        }
        for (sem, batch_year), page_numbers in sorted(pages_by_sem_batch.items())
    ]

    return {
        "semesters": semesters_found,
        "batches_by_semester": batches_payload,
        "pages_by_semester_batch": page_links_payload,
    }


def extract_results_from_file(
    recognized_subjects: list[str],
    semester: int,
    file: str,
    regno_slug: str | None = None,
    department_code: int | None = None,
) -> list[Result] | None:
    """Extract semester results from a PDF filtered by regno slug or department code."""
    if regno_slug is None and department_code is None:
        raise ValueError("Either regno_slug or department_code must be provided.")

    normalized_slug = regno_slug.strip() if regno_slug else None
    dept_pattern: re.Pattern[str] | None = None
    dept_page_pattern: re.Pattern[str] | None = None
    if department_code is not None:
        dept_pattern = re.compile(rf"^8128\d{{2}}{department_code}\d{{3}}$")
        dept_page_pattern = re.compile(rf"8128\d{{2}}{department_code}\d{{3}}")

    known_subjects = {subject.strip().upper() for subject in recognized_subjects}
    results_by_regno: dict[str, Result] = {}
    active_subject_indices: dict[str, int] | None = None

    with pdfplumber.open(file) as pdf:
        pages: list[int] = []
        sem_page_found = False
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            semester_match = SEMESTER_LINE_REGEX.search(text)
            page_semester = (
                int(semester_match.group("sem") or "0")
                if semester_match
                else None
            )

            if page_semester is not None:
                sem_page_found = page_semester == semester
                if sem_page_found:
                    pages.append(i)
                continue

            if text and sem_page_found:
                if normalized_slug and normalized_slug in text:
                    pages.append(i)
                elif dept_page_pattern and dept_page_pattern.search(text):
                    pages.append(i)

        print(f"Semester pages found: {pages}")

        for page_num in pages:
            page = pdf.pages[page_num]
            table = page.extract_table()
            if not table:
                continue

            header_index: int | None = None
            detected_subject_indices: dict[str, int] | None = None

            # Some PDFs have multi-row headers; continuation pages may omit headers.
            header_scan_limit = min(4, len(table))
            for idx in range(header_scan_limit):
                header = [
                    str(cell).strip().replace("\n", "") if cell else ""
                    for cell in table[idx]
                ]
                subject_indices = {
                    str(subject_code).strip().upper(): index
                    for index, subject_code in enumerate(header)
                    if str(subject_code).strip().upper() in known_subjects
                }
                if subject_indices:
                    header_index = idx
                    detected_subject_indices = subject_indices
                    break

            if detected_subject_indices is not None:
                active_subject_indices = detected_subject_indices
                data_rows = table[(header_index + 1) if header_index is not None else 1 :]
            elif active_subject_indices is not None:
                data_rows = table
            else:
                continue

            for row in data_rows:
                regno = str(row[0]).strip() if row and row[0] else ""
                if not regno or not regno.isdigit() or len(regno) < 8:
                    continue

                include_row = False
                if normalized_slug and regno.startswith(normalized_slug):
                    include_row = True
                elif dept_pattern and dept_pattern.match(regno):
                    include_row = True

                if not include_row:
                    continue

                existing = results_by_regno.get(regno)
                if existing is None:
                    existing = {
                        "regno": regno,
                        "name": str(row[1]).strip()
                        if len(row) > 1 and row[1]
                        else "N/A",
                        "subjects": {},
                    }
                    results_by_regno[regno] = existing
                elif (
                    (not existing.get("name") or str(existing.get("name")) == "N/A")
                    and len(row) > 1
                    and row[1]
                ):
                    existing["name"] = str(row[1]).strip()

                subjects = existing.get("subjects")
                if not isinstance(subjects, dict):
                    subjects = {}
                    existing["subjects"] = subjects

                for subject, idx in active_subject_indices.items():
                    grade = (
                        str(row[idx]).strip().upper()
                        if idx < len(row) and row[idx]
                        else "NA"
                    )
                    # Duplicate subject entries within one ingest are resolved by recency.
                    subjects[subject] = grade

        if not results_by_regno:
            print("No semester table found in the document.")
            return

        results: list[Result] = []
        for regno in sorted(results_by_regno):
            result_row = results_by_regno[regno]
            subjects = result_row.get("subjects")
            if isinstance(subjects, dict) and all(
                str(grade).upper() == "NA" for grade in subjects.values()
            ):
                print(f"Skipping {regno} as all grades are NA: {subjects}")
                continue
            results.append(result_row)

        return results


def extract_results(
    regno_slug: str,
    recognized_subjects: list[str],
    semester: int = 5,
    file: str = "205_ND2025.pdf",
) -> list[Result] | None:
    return extract_results_from_file(
        regno_slug=regno_slug,
        recognized_subjects=recognized_subjects,
        semester=semester,
        file=file,
    )


def store_results(results: list[dict[str, str | dict[str, str]]], filename: str):
    import json

    with open(filename, "w") as f:
        json.dump(results, f, indent=4)


def load_results(filename: str) -> list[dict[str, str | dict[str, str]]]:
    import json

    with open(filename, "r") as f:
        return json.load(f)


def get_sem_result_summary(
    results: list[dict[str, str | dict[str, str]]], aggregate_subjects: bool = False
) -> dict[str, int | float]:
    summary: dict[str, int | float] = {
        "appeared": 0,
        "passed": 0,
        "failed": 0,
        "pass_percentage": 0.0,
        "one_arrear": 0,
        "two_arrears": 0,
        "three+_arrears": 0,
    }

    for result in results:
        if not result.get("subjects") or not isinstance(result["subjects"], dict):
            print(
                f"Skipping result for {result.get('regno', 'Unknown RegNo')}: 'subjects' key is missing or not a dictionary."
            )
            continue

        if not all(grade == "UA" for grade in result["subjects"].values()):
            summary["appeared"] += 1
            if not any(grade == "U" for grade in result["subjects"].values()):
                summary["passed"] += 1
            if sum(grade == "U" for grade in result["subjects"].values()) == 1:
                summary["one_arrear"] += 1
            if sum(grade == "U" for grade in result["subjects"].values()) == 2:
                summary["two_arrears"] += 1
            if sum(grade == "U" for grade in result["subjects"].values()) >= 3:
                summary["three+_arrears"] += 1

    summary["failed"] = summary["appeared"] - summary["passed"]
    summary["pass_percentage"] = (
        (summary["passed"] / summary["appeared"] * 100)
        if summary["appeared"] > 0
        else 0.0
    )

    return summary


def get_subject_wise_summary(
    results: list[dict[str, str | dict[str, str]]],
    regnos: list[str] | None = None,
):
    subject_summary: dict[str, dict[str, int | float]] = {}

    results = [
        result
        for result in results
        if result.get("regno")
        and isinstance(result["regno"], str)
        and (not regnos or result["regno"] in regnos)
    ]

    for result in results:
        if not result.get("regno") or not isinstance(result["regno"], str):
            print(f"Skipping invalid result entry: {result}")
            continue

        if not result.get("subjects") or not isinstance(result["subjects"], dict):
            print(
                f"Skipping result for {result.get('regno', 'Unknown RegNo')}: 'subjects' key is missing or not a dictionary."
            )
            continue

        for subject, grade in result["subjects"].items():
            if subject not in subject_summary:
                subject_summary[subject] = {
                    "appeared": 0,
                    "passed": 0,
                    "pass_percentage": 0.0,
                    "failed": 0,
                }
            if grade != "NA":
                subject_summary[subject]["appeared"] += 1
                if grade != "U":
                    subject_summary[subject]["passed"] += 1
                else:
                    subject_summary[subject]["failed"] += 1

    footer = {
        "Total Students": len(results),
        "1 Arrear": sum(
            1
            for result in results
            if result.get("subjects")
            and isinstance(result["subjects"], dict)
            and sum(grade == "U" for grade in result["subjects"].values()) == 1
        ),
        "2 Arrears": sum(
            1
            for result in results
            if result.get("subjects")
            and isinstance(result["subjects"], dict)
            and sum(grade == "U" for grade in result["subjects"].values()) == 2
        ),
        "3+ Arrears": sum(
            1
            for result in results
            if result.get("subjects")
            and isinstance(result["subjects"], dict)
            and sum(grade == "U" for grade in result["subjects"].values()) >= 3
        ),
    }

    for subject, summary in subject_summary.items():
        summary["pass_percentage"] = (
            (summary["passed"] / summary["appeared"] * 100)
            if summary["appeared"] > 0
            else 0.0
        )

    return subject_summary, footer


def get_arrear_students(
    results: list[dict[str, str | dict[str, str]]],
    bucket: str | None = None,
    exact_count: int | None = None,
):
    students_with_arrears: list[dict[str, str | int]] = []
    counts = {
        "1": 0,
        "2": 0,
        "3+": 0,
        "4": 0,
        "5": 0,
    }

    for result in results:
        subjects = result.get("subjects")
        if not isinstance(subjects, dict):
            continue

        # Keep the same interpretation as the semester summary logic.
        if all(grade == "UA" for grade in subjects.values()):
            continue

        arrear_count = sum(grade == "U" for grade in subjects.values())

        if arrear_count == 1:
            counts["1"] += 1
        if arrear_count == 2:
            counts["2"] += 1
        if arrear_count >= 3:
            counts["3+"] += 1
        if arrear_count == 4:
            counts["4"] += 1
        if arrear_count == 5:
            counts["5"] += 1

        include = False
        if exact_count is not None:
            include = arrear_count == exact_count
        elif bucket == "1":
            include = arrear_count == 1
        elif bucket == "2":
            include = arrear_count == 2
        elif bucket == "3+":
            include = arrear_count >= 3

        if include:
            students_with_arrears.append(
                {
                    "regno": str(result.get("regno", "")),
                    "name": str(result.get("name", "N/A")),
                    "arrears": arrear_count,
                }
            )

    students_with_arrears.sort(
        key=lambda item: (int(item["arrears"]), str(item["regno"]))
    )
    return counts, students_with_arrears


def get_overall_summary(
    semester_summaries: dict[int, dict[str, int | float]],
) -> dict[str, int | float]:
    overall_summary: dict[str, int | float] = {
        "appeared": 0,
        "passed": 0,
        "failed": 0,
        "pass_percentage": 0.0,
        "one_arrear": 0,
        "two_arrears": 0,
        "three+_arrears": 0,
    }

    for _, summary in semester_summaries.items():
        overall_summary["appeared"] += summary.get("appeared", 0)
        overall_summary["passed"] += summary.get("passed", 0)
        overall_summary["failed"] += summary.get("failed", 0)
        overall_summary["one_arrear"] += summary.get("one_arrear", 0)
        overall_summary["two_arrears"] += summary.get("two_arrears", 0)
        overall_summary["three+_arrears"] += summary.get("three+_arrears", 0)

    overall_summary["pass_percentage"] = (
        (overall_summary["passed"] / overall_summary["appeared"] * 100)
        if overall_summary["appeared"] > 0
        else 0.0
    )

    return overall_summary


def get_student_results(
    regno: str,
    results: list[Result],
) -> Result | None:
    for result in results:
        if result.get("regno") == regno:
            return result
    return None


def compare_results_students(
    regno1: str,
    regno2: str,
    results: list[Result],
    sem: int,
) -> dict[str, list[str]] | None:
    student1_results = get_student_results(regno1, results)
    stud1_name = student1_results.get("name", "N/A") if student1_results else "N/A"
    student2_results = get_student_results(regno2, results)
    stud2_name = student2_results.get("name", "N/A") if student2_results else "N/A"
    if not student1_results or not student2_results:
        print("One or both students not found in results.")
        return None

    if not student1_results or not student2_results:
        print("One or both registration numbers not found.")
        return None
    print(f"Comparison between {regno1} and {regno2}:")

    if not student1_results.get("subjects") or not isinstance(
        student1_results["subjects"], dict
    ):
        print(f"Student {regno1} has no valid 'subjects' data.")
        return None
    if not student2_results.get("subjects") or not isinstance(
        student2_results["subjects"], dict
    ):
        print(f"Student {regno2} has no valid 'subjects' data.")
        return None

    all_subjects = sorted(
        set(student1_results["subjects"].keys()).union(
            student2_results["subjects"].keys()
        )
    )
    table = []
    for sub in all_subjects:
        r1 = grade_mapping.get(student1_results["subjects"].get(sub, "NA"), "0")
        r2 = grade_mapping.get(student2_results["subjects"].get(sub, "NA"), "0")
        # Try to convert grades to int for difference calculation
        try:
            g1 = int(r1)
        except (ValueError, TypeError):
            g1 = None
        try:
            g2 = int(r2)
        except (ValueError, TypeError):
            g2 = None
        if g1 is not None and g2 is not None:
            diff = g1 - g2
            diff_str = f"{diff:+d}"
        else:
            diff_str = "-"
        table.append([sub, get_subject_name(sub), r1, r2, diff_str])
    headers = [
        "Subject",
        "Subject Name",
        f"{stud1_name} ({regno1[-3:]})",
        f"{stud2_name} ({regno2[-3:]})",
        "Diff",
    ]
    gp1 = sum(
        grade_mapping.get(grade, 0) for grade in student1_results["subjects"].values()
    )
    gp2 = sum(
        grade_mapping.get(grade, 0) for grade in student2_results["subjects"].values()
    )

    gp_diff = gp1 - gp2
    table.append(["Total GP", "", str(gp1), str(gp2), f"{gp_diff:+d}"])

    sgpa1 = calculate_sgpa(sem, student1_results["subjects"])
    sgpa2 = calculate_sgpa(sem, student2_results["subjects"])

    return {
        "headers": headers,
        "table": table,
        "footer": [
            f"SGPA {regno1}: {sgpa1:.2f}",
            f"SGPA {regno2}: {sgpa2:.2f}",
            f"SGPA Difference: {(sgpa1 - sgpa2):+.2f}",
        ],
    }


def generate_rank_list(
    results: list[Result], sem: int, top_k: int = 10
) -> list[tuple[int, str, str, float]]:

    sgpa_results = []
    for result in results:
        regNo = result.get("regno")
        res = result.get("subjects")
        name = result.get("name", "N/A")
        if not regNo:
            print(f"Skipping invalid result entry: {result}")
            continue
        if not res or not isinstance(res, dict):
            print(f"Skipping {regNo} as 'subjects' data is missing or invalid.")
            continue

        # if the student has failed one subject, their SGPA is considered 0 for ranking purposes
        if any(grade == "U" or grade == "UA" for grade in res.values()):
            sgpa = 0
        else:
            sgpa = calculate_sgpa(sem, res)
        sgpa_results.append((sgpa, regNo, name))

    sgpa_results.sort(
        reverse=True, key=lambda x: x[0]
    )  # sort by SGPA in descending order

    ranks: list[tuple[int, str, str, float]] = []

    prev_rank = 0
    for i, (sgpa, regNo, name) in enumerate(sgpa_results):
        prev_sgpa = sgpa_results[i - 1][0] if i > 0 else None
        if prev_sgpa is not None and sgpa == prev_sgpa:
            rank = prev_rank
        else:
            rank = prev_rank + 1

        ranks.append((rank, regNo, name, sgpa))
        prev_rank = rank

    return ranks[:top_k]
