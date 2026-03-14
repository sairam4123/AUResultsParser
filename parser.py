import pdfplumber

from constants import calculate_sgpa, grade_mapping

type Result = dict[str, str | dict[str, str]]


def extract_results(
    regno_slug: str,
    recognized_subjects: list[str],
    semester: int = 5,
    file: str = "205_ND2025.pdf",
) -> list[Result] | None:
    results = []
    table = []

    with pdfplumber.open(file) as pdf:
        # search for slug in pdf and get the page numbers where the slug is found
        pages: list[int] = []
        sem_page_found = False
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()

            if text and ("Semester No. : " + f"{semester:02d}") in text:
                sem_page_found = True
                pages.append(i)
            elif (text and regno_slug in text and sem_page_found) or (
                text
                and "Semester No. : " + f"{semester:02d}" in text
                and sem_page_found
            ):
                pages.append(i)
        print(f"Slug found on pages: {pages}")

        for page_num in pages:
            page = pdf.pages[page_num]
            text = page.extract_table()
            if not text:
                print("No table found on the page.")
                return
            table.extend(text)
        if not table:
            print("No semester table found in the document.")
            return

        header = table[0]
        # clean the header row by stripping whitespace and removing newlines if any
        header = [str(h).strip().replace("\n", "") for h in header]
        print(header, recognized_subjects)

        subject_indices = {
            subj: header.index(subj) for subj in recognized_subjects if subj in header
        }
        print(subject_indices)

        for row in table:
            if row[0] and str(row[0]).startswith(regno_slug):
                result_row = {"regno": row[0], "subjects": {}}
                for subject, idx in subject_indices.items():
                    # find the idx of the subject in the header row
                    # print(f"Processing {row[0]} - {subject}")
                    result_row["subjects"][subject] = (
                        row[idx] if idx < len(row) and row[idx] else "NA"
                    )
                if all(grade == "NA" for grade in result_row["subjects"].values()):
                    print(
                        f"Skipping {row[0]} as all grades are NA: {result_row['subjects']}"
                    )
                    continue
                results.append(result_row)

        return results


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
    student2_results = get_student_results(regno2, results)
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
        table.append([sub, r1, r2, diff_str])
    headers = ["Subject", regno1, regno2, "Diff"]
    gp1 = sum(
        grade_mapping.get(grade, 0) for grade in student1_results["subjects"].values()
    )
    gp2 = sum(
        grade_mapping.get(grade, 0) for grade in student2_results["subjects"].values()
    )

    gp_diff = gp1 - gp2
    table.append(["Total GP", str(gp1), str(gp2), f"{gp_diff:+d}"])

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
) -> list[tuple[int, str, float]]:

    sgpa_results = []
    for result in results:
        regNo = result.get("regno")
        res = result.get("subjects")
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
        sgpa_results.append((sgpa, regNo))

    sgpa_results.sort(
        reverse=True, key=lambda x: x[0]
    )  # sort by SGPA in descending order

    ranks: list[tuple[int, str, float]] = []

    prev_rank = 0
    for i, (sgpa, regNo) in enumerate(sgpa_results):
        prev_sgpa = sgpa_results[i - 1][0]
        if sgpa == prev_sgpa:
            rank = prev_rank
        else:
            rank = prev_rank + 1

        ranks.append((rank, regNo, sgpa))
        prev_rank = rank

    return ranks[:top_k]
