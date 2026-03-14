from tabulate import tabulate

from new_parser import (
    compare_results_students,
    extract_results,
    generate_rank_list,
    get_overall_summary,
    get_sem_result_summary,
    get_student_results,
    get_subject_wise_summary,
    load_results,
    store_results,
)
from result import calculate_sgpa, subject_sem_mapping, dept_codes


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
        summary[sem] = get_sem_result_summary(results[sem])

    # find overall summary
    overall_summary = get_overall_summary(summary)

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


def interactive_extract_results():
    # regno_slug = input("Enter the registration number slug (e.g., '812822205'): ")
    batch = input("Enter the batch year (e.g., '2025'): ")
    semester = int(input("Enter the semester number (e.g., 7): "))
    examname = input("Enter the Exam Name (e.g., 'ND2025', 'AM2025'): ")
    recognized_subjects = sorted(get_subjects_for_semester(semester))
    dept_code = dept_codes.get(
        input("Enter the department (any of 'IT', 'AIML'): ").strip().upper(), "000"
    )
    regno_slug = "8128" + batch[2:4] + str(dept_code)
    filename = f"{dept_code}_{examname}.pdf"
    print("Using registration slug:", regno_slug)
    print("Recognized subjects for semester", semester, ":", recognized_subjects)
    print("Using department code:", dept_code)

    confirm = input("Proceed with the above details? (Y/N): ").strip().upper()
    if confirm.lower().startswith("y"):
        print("Aborting result extraction.")
        return

    results = extract_results(
        regno_slug=regno_slug,
        recognized_subjects=recognized_subjects,
        semester=semester,
        file=filename,
    )

    if not results:
        print("No results found for the given registration slug.")
    else:
        store_results(results, f"semester_{semester}_results_{dept_code}.json")
        print(
            f"Results for {regno_slug} in semester {semester} is saved.",
            f"Subjects extracted: {recognized_subjects}",
            f"Results stored in semester_{semester}_results_{dept_code}.json",
        )


def interactive_compare_students():
    sem = int(input("Enter the semester number to compare (e.g., 7): "))
    dept_code = dept_codes.get(
        input("Enter the department (any of 'IT', 'AIML'): ").strip().upper(), "000"
    )
    results = load_results(f"semester_{sem}_results_{dept_code}.json")
    if not results:
        print(f"No results found for semester {sem} and department code {dept_code}.")
        return

    regNo1 = input("Enter the first student's registration number: ").strip()
    regNo2 = input("Enter the second student's registration number: ").strip()
    results = compare_results_students(regNo1, regNo2, results, sem)
    if not results:
        print("Comparison failed due to missing data.")
        return
    headers = results["headers"]
    table = results["table"]
    footer = results["footer"]

    tabulated_table = tabulate(table, headers=headers, tablefmt="grid")
    print(tabulated_table)
    print("\n".join(footer))


def interactive_student_rank_list():
    sem = int(input("Enter the semester number to generate rank list for (e.g., 7): "))
    dept_code = dept_codes.get(
        input("Enter the department (any of 'IT', 'AIML'): ").strip().upper(), "000"
    )
    results = load_results(f"semester_{sem}_results_{dept_code}.json")
    if not results:
        print(
            f"No results found for semester {sem} and department code {dept_code}. Try extracting results first."
        )
        return
    top_k = input("Enter the number of top students to display (default: 10): ").strip()
    if not top_k.isdigit():
        print("Invalid number entered for top students. Defaulting to 10.")
        top_k = 10
    rank_list = generate_rank_list(results, sem, top_k=int(top_k))
    if not rank_list:
        print("Failed to generate rank list due to missing data.")
        return
    headers = ["Rank", "Registration Number", "SGPA"]
    tabulated = tabulate(rank_list, headers=headers, tablefmt="grid")
    print(tabulated)


def interactive_per_student_results():
    regNo = input("Enter the student's registration number: ").strip()
    sem = int(input("Enter the semester number to view results for (e.g., 7): "))
    dept_code = dept_codes.get(
        input("Enter the department (any of 'IT', 'AIML'): ").strip().upper(), "000"
    )
    results = load_results(f"semester_{sem}_results_{dept_code}.json")
    if not results:
        print(f"No results found for semester {sem} and department code {dept_code}.")
        return
    student_results = get_student_results(regNo, results)
    if not student_results:
        print(f"No results found for registration number {regNo} in semester {sem}.")
        return

    tabulated = tabulate(
        student_results.items(), headers=["Subject", "Grade"], tablefmt="grid"
    )
    print(tabulated)
    print(f"SGPA: {calculate_sgpa(sem, student_results):.2f}")


def interactive_class_result_analysis():
    print("Class Result Analysis is not implemented yet.")

    class_name = input("Enter the class name (e.g., 'E37'): ").strip().upper()
    dept_code = dept_codes.get(
        input("Enter the department (any of 'IT', 'AIML'): ").strip().upper(), "000"
    )
    batch = input("Enter the batch year (2023-25): ")
    sem = int(input("Enter the semester: "))

    # FIXME: Fetch the intervals from API instead of user input
    regno_intervals = input(
        "Enter registration number intervals to analyze (comma separated, e.g., '1-59,62-64,70'): "
    ).split(",")

    slug = f"8128{batch[2:4]}{dept_code}"

    results = load_results(f"semester_{sem}_results_{dept_code}.json")
    if not results:
        print(
            f"No results found for semester {sem} and department code {dept_code}. Try extracting results first."
        )
        return

    # fill the regnos based on intervals
    regnos = []
    for interval in regno_intervals:
        interval = interval.strip()
        if "-" in interval:
            start, end = interval.split("-")
            if not start.isdigit() or not end.isdigit():
                print(f"Invalid interval '{interval}' entered. Skipping.")
                continue
            regnos.extend(
                [f"{slug}{num:03d}" for num in range(int(start), int(end) + 1)]
            )
        else:
            if not interval.isdigit():
                print(f"Invalid registration number '{interval}' entered. Skipping.")
                continue
            regnos.append(f"{slug}{int(interval):03d}")
    print("Analyzing results for the following registration numbers:")
    for regno in regnos:
        print(regno)

    summary, footer = get_subject_wise_summary(results, regnos)

    tabulated_summary = [
        ["Subject", "Appeared", "Passed", "Failed", "Pass Percentage"],
        *[
            [
                subject,
                summary[subject]["appeared"],
                summary[subject]["passed"],
                summary[subject]["failed"],
                f"{summary[subject]['pass_percentage']:.2f}%",
            ]
            for subject in summary
        ],
    ]
    print("Result Analysis for class", class_name, "in semester", sem)
    tabulated = tabulate(tabulated_summary, headers="firstrow", tablefmt="grid")
    print(tabulated)
    print(
        "\n".join(
            f"{footer_label}: {footer_value}"
            for footer_label, footer_value in footer.items()
        )
    )


def main():
    options = [
        (0, "Extract results and save"),
        (1, "Department-wise result analysis"),
        (2, "Print per student results"),
        (3, "Compare students"),
        (4, "Student rank list"),
        (5, "Class Result Analysis"),
        (9, "Exit"),
    ]
    options_dict = {opt[0]: opt[1] for opt in options}

    while True:
        print("\n" + "=" * 50)
        print("AU Results Parser - Main Menu")
        print("=" * 50)
        print("\nSelect an option:")
        for idx, option in options:
            print(f"{idx}. {option}")

        choice = input("Enter your choice: ")
        if not choice.isdigit() or int(choice) not in [opt[0] for opt in options]:
            print("Invalid choice. Please try again.")
            continue

        print("\n" + "=" * 50)
        print(f"You selected: {options_dict[int(choice)]}")
        print("=" * 50 + "\n")
        choice = int(choice)
        if choice == 0:
            # Extract results
            interactive_extract_results()
        elif choice == 1:
            # Print results summary
            interactive_result_summary()
        elif choice == 2:
            # Print per student results
            interactive_per_student_results()
            pass
        elif choice == 3:
            # Compare students
            interactive_compare_students()
            pass
        elif choice == 4:
            # Generate rank list
            interactive_student_rank_list()
            pass
        elif choice == 5:
            # Class Result Analysis
            interactive_class_result_analysis()
            pass
        elif choice == 9:
            print("Exiting...")
            break


if __name__ == "__main__":
    main()
