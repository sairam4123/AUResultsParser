from tabulate import tabulate

from new_parser import extract_results, load_results, store_results
from result import subject_sem_mapping, dept_codes


def get_subjects_for_semester(semester: int) -> list[str]:
    return [sub for sub, sem in subject_sem_mapping.items() if sem == semester]


# results = extract_results(
#     "812822205",
#     sorted(get_subjects_for_semester(7)),
#     semester=7,
#     file="205_ND2025.pdf",
# )
# if not results:
#     print("No results found for the given registration slug.")
# else:
#     store_results(results, "semester_7_results.json")


# results = extract_results(
#     "812824148",
#     sorted(get_subjects_for_semester(3)),
#     semester=3,
#     file="148_ND2025.pdf",
# )
# if not results:
#     print("No results found for the given registration slug.")
# else:
#     store_results(results, "semester_3_results_148.json")


def get_result_summary(
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
    # assert isinstance(summary["appeared"], int) and isinstance(
    #     summary["passed"], int
    # )
    # summary["appeared"] += 1
    # if grade in ["O", "A+", "A", "B+", "B", "C"]:
    #     summary["passed"] += 1

    # if not aggregate_subjects:
    #     summary[subject] = summary.get(subject, {"appeared": 0, "passed": 0})
    #     assert isinstance(summary[subject], dict)
    #     if grade not in ["UA"]:
    #         summary[subject]["appeared"] += 1
    #         if grade in ["O", "A+", "A", "B+", "B", "C"]:
    #             summary[subject]["passed"] += 1
    # if aggregate_subjects:

    return summary


def interactive_result_summary():
    dept = input("Enter the department (any of 'IT', 'AIML'): ").strip().upper()
    dept_code = dept_codes.get(dept, "000")

    sems = input(
        "Enter the semesters to include (comma separated, e.g., '3,5,7'): "
    ).split(",")

    results = {}
    for sem in sems:
        sem = sem.strip()
        if not sem.isdigit():
            print(f"Invalid semester '{sem}' entered. Skipping.")
            continue
        sem_results = load_results(f"semester_{sem}_results_{dept_code}.json")
        if not sem_results:
            print(f"No results found for semester {sem}. Skipping.")
            continue
        results[sem] = sem_results

    summary = {}
    for sem in results:
        print(f"Summary for Semester {sem}:")
        summary[sem] = get_result_summary(results[sem])

    # find overall summary
    overall_summary = {
        "appeared": sum(summary[sem]["appeared"] for sem in summary),
        "passed": sum(summary[sem]["passed"] for sem in summary),
        "failed": sum(summary[sem]["failed"] for sem in summary),
        "pass_percentage": (
            (
                sum(summary[sem]["passed"] for sem in summary)
                / sum(summary[sem]["appeared"] for sem in summary)
                * 100
            )
            if sum(summary[sem]["appeared"] for sem in summary) > 0
            else 0.0
        ),
        "one_arrear": sum(summary[sem]["one_arrear"] for sem in summary),
        "two_arrears": sum(summary[sem]["two_arrears"] for sem in summary),
        "three+_arrears": sum(summary[sem]["three+_arrears"] for sem in summary),
    }

    print("\nOverall Summary:")
    tabulated_summary = [
        [
            "Semester",
            "Appeared",
            "Passed",
            "Failed",
            "Pass Percentage",
            "1 Arrear",
            "2 Arrears",
            "3+ Arrears",
        ],
        *[
            [
                sem,
                summary[sem]["appeared"],
                summary[sem]["passed"],
                summary[sem]["failed"],
                f"{summary[sem]['pass_percentage']:.2f}%",
                summary[sem]["one_arrear"],
                summary[sem]["two_arrears"],
                summary[sem]["three+_arrears"],
            ]
            for sem in summary
        ],
        [
            "Overall",
            overall_summary["appeared"],
            overall_summary["passed"],
            overall_summary["failed"],
            f"{overall_summary['pass_percentage']:.2f}%",
            overall_summary["one_arrear"],
            overall_summary["two_arrears"],
            overall_summary["three+_arrears"],
        ],
    ]
    tabulated = tabulate(tabulated_summary, headers="firstrow", tablefmt="grid")
    print(tabulated)

    # e47_results = get_result_summary(
    #     load_results(f"semester_7_results_{dept_code}.json")
    # )
    # e37_results = get_result_summary(
    #     load_results(f"semester_5_results_{dept_code}.json")
    # )
    # e27_results = get_result_summary(
    #     load_results(f"semester_3_results_{dept_code}.json")
    # )
    # e29_results = get_result_summary(
    #     load_results(f"semester_3_results_{dept_code}.json")
    # )

    # # aggregate all results for overall pass percentage
    # overall_summary = {
    #     "appeared": e47_results["appeared"]
    #     + e37_results["appeared"]
    #     + e27_results["appeared"],
    #     # + e29_results["appeared"],
    #     "passed": e47_results["passed"] + e37_results["passed"] + e27_results["passed"],
    #     # + e29_results["passed"],
    #     "one_arrear": e47_results["one_arrear"]
    #     + e37_results["one_arrear"]
    #     + e27_results["one_arrear"],
    #     # + e29_results["one_arrear"],
    #     "two_arrears": e47_results["two_arrears"]
    #     + e37_results["two_arrears"]
    #     + e27_results["two_arrears"],
    #     # + e29_results["two_arrears"],
    #     "three+_arrears": e47_results["three+_arrears"]
    #     + e37_results["three+_arrears"]
    #     + e27_results["three+_arrears"],
    #     # + e29_results["three+_arrears"],
    # }

    # overall_summary["failed"] = overall_summary["appeared"] - overall_summary["passed"]
    # overall_summary["pass_percentage"] = (
    #     (overall_summary["passed"] / overall_summary["appeared"] * 100)
    #     if overall_summary["appeared"] > 0
    #     else 0.0
    # )

    # print(e47_results, "E47")
    # print(e37_results, "E37")
    # print(e27_results, "E27")
    # print(e29_results, "E29")
    # print(overall_summary, "Overall")

    # # tabulate the results in a table format
    # table = [
    #     [
    #         "Dept",
    #         "Class",
    #         "Appeared",
    #         "Passed",
    #         "Failed",
    #         "Pass Percentage",
    #         "1 Arrear",
    #         "2 Arrears",
    #         "3+ Arrears",
    #     ],
    #     [
    #         "IT",
    #         "E47",
    #         e47_results["appeared"],
    #         e47_results["passed"],
    #         e47_results["failed"],
    #         f"{e47_results['pass_percentage']:.2f}%",
    #         e47_results["one_arrear"],
    #         e47_results["two_arrears"],
    #         e47_results["three+_arrears"],
    #     ],
    #     [
    #         "IT",
    #         "E37",
    #         e37_results["appeared"],
    #         e37_results["passed"],
    #         e37_results["failed"],
    #         f"{e37_results['pass_percentage']:.2f}%",
    #         e37_results["one_arrear"],
    #         e37_results["two_arrears"],
    #         e37_results["three+_arrears"],
    #     ],
    #     [
    #         "IT",
    #         "E27",
    #         e27_results["appeared"],
    #         e27_results["passed"],
    #         e27_results["failed"],
    #         f"{e27_results['pass_percentage']:.2f}%",
    #         e27_results["one_arrear"],
    #         e27_results["two_arrears"],
    #         e27_results["three+_arrears"],
    #     ],
    #     # [
    #     #     "AIML",
    #     #     "E29",
    #     #     e29_results["appeared"],
    #     #     e29_results["passed"],
    #     #     e29_results["failed"],
    #     #     f"{e29_results['pass_percentage']:.2f}%",
    #     #     e29_results["one_arrear"],
    #     #     e29_results["two_arrears"],
    #     #     e29_results["three+_arrears"],
    #     # ],
    #     [
    #         "Overall",
    #         "",
    #         overall_summary["appeared"],
    #         overall_summary["passed"],
    #         overall_summary["failed"],
    #         f"{overall_summary['pass_percentage']:.2f}%",
    #         overall_summary["one_arrear"],
    #         overall_summary["two_arrears"],
    #         overall_summary["three+_arrears"],
    #     ],
    # ]

    # print(tabulate(table, headers="firstrow", tablefmt="grid"))


def interactive_extract_results():
    regno_slug = input("Enter the registration number slug (e.g., '812822205'): ")
    semester = int(input("Enter the semester number (e.g., 7): "))
    file = input("Enter the PDF file name (e.g., '205_ND2025.pdf'): ")
    recognized_subjects = sorted(get_subjects_for_semester(semester))
    dept_code = dept_codes.get(
        input("Enter the department (any of 'IT', 'AIML'): ").strip().upper(), "unknown"
    )

    results = extract_results(
        regno_slug=regno_slug,
        recognized_subjects=recognized_subjects,
        semester=semester,
        file=file,
    )

    if not results:
        print("No results found for the given registration slug.")
    else:
        store_results(
            results, f"{regno_slug}_semester_{semester}_results_{dept_code}.json"
        )
        print(
            f"Results for {regno_slug} in semester {semester} is saved.",
            f"Subjects extracted: {recognized_subjects}",
            f"Results stored in {regno_slug}_semester_{semester}_results.json",
        )


def main():
    options = [
        (0, "Extract results and save"),
        (1, "Department-wise result analysis"),
        (2, "Print per student results"),
        (3, "Compare students"),
        (4, "Student rank list"),
        (6, "Class Result Analysis"),
        (9, "Exit"),
    ]

    while True:
        print("\nSelect an option:")
        for idx, option in options:
            print(f"{idx}. {option}")

        choice = input("Enter your choice: ")
        if not choice.isdigit() or int(choice) not in range(len(options)):
            print("Invalid choice. Please try again.")
            continue

        choice = int(choice)
        if choice == 0:
            # Extract results
            interactive_extract_results()
        elif choice == 1:
            # Print results summary
            interactive_result_summary()
        elif choice == 2:
            # Print per student results
            pass
        elif choice == 3:
            # Compare students
            pass
        elif choice == 4:
            print("Exiting...")
            break


if __name__ == "__main__":
    main()
