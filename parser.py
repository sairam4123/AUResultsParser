import pypdf

from result import calculate_sgpa
from tabulate import tabulate

from result import grade_mapping

reader = pypdf.PdfReader("205_ND2025.pdf")
text1 = reader.get_page(11).extract_text(extraction_mode="plain")
results1 = text1.split("\n")[4:-3]
# print(results1)

# layout1 = reader.get_page(11)
# # print(layout1)
# result0 = [line for line in layout1.split("\n") if line.strip()]
# print(result0[6:-3])

text2 = reader.get_page(12).extract_text(extraction_mode="plain")
results2 = text2.split("\n")[4:-3]

text3 = reader.get_page(13).extract_text(extraction_mode="plain")
results3 = text3.split("\n")[4:-3]

sem = 5

# text1 = reader.get_page(8).extract_text(extraction_mode='plain')
# results1 = text1.split("\n")[4:-3]

# text2 = reader.get_page(9).extract_text(extraction_mode='plain')
# results2 = text2.split("\n")[4:-3]

# text3 = reader.get_page(10).extract_text(extraction_mode='plain')
# results3 = text3.split("\n")[4:-3]

# text1 = reader.get_page(7).extract_text(extraction_mode='plain')
# results1 = text1.split("\n")[4:-3]

# text2 = reader.get_page(8).extract_text(extraction_mode='plain')
# results2 = text2.split("\n")[4:-3]

# text3 = reader.get_page(9).extract_text(extraction_mode='plain')
# results3 = text3.split("\n")[4:-3]


results = results1 + results2 + results3


def parse_results(_range: tuple = (0, 100)):
    subs = [
        # "CS3451",
        # "CS3452",
        # "CS3461",
        # "CS3481",
        # "CS3491",
        # "CS3492",
        # "GE3451",
        # "IT3401",
        # "NM1075",
        "CCS334",
        "CCS335",
        "CS3551",
        "CS3591",
        "CS3691",
        "IT3501",
        "IT3511",
        "MX3084",
        "NM1120",
    ]

    results_dict = {sub: {"passed": 0, "appeared": 0, "scode": sub} for sub in subs}
    for result in results:
        regno = result.split(" ")[0]
        is_our_student = regno.startswith("812823")
        if not is_our_student:
            continue

        if regno in ["812823205060", "812823205016", "812823205019"]:
            subs = [
                "CCS334",
                "CCS335",
                "dummy1",
                "dummy2",
                "CS3551",
                "CS3591",
                "CS3691",
                "IT3501",
                "IT3511",
                "MX3084",
                "NM1120",
            ]
        else:
            subs = [
                # "CS3451",
                # "CS3452",
                # "CS3461",
                # "CS3481",
                # "CS3491",
                # "CS3492",
                # "GE3451",
                # "IT3401",
                # "NM1075",
                "CCS334",
                "CCS335",
                "CS3551",
                "CS3591",
                "CS3691",
                "IT3501",
                "IT3511",
                "MX3084",
                "NM1120",
            ]

        rollno = int(regno[-1:-3:-1][::-1])

        if rollno < _range[0] or rollno > _range[1]:
            continue

        if regno in ["812823205060", "812823205016", "812823205019"]:
            sub_res = result.split(" ")[-1:-12:-1][::-1]
        else:
            sub_res = result.split(" ")[-1:-10:-1][::-1]

        for s_idx, sub in enumerate(subs):
            # print(f"Processing {regno} - {sub} - {sub_res[s_idx]}")
            res = sub_res[s_idx]
            if sub not in results_dict:
                continue
            if res != "UA":
                results_dict[sub]["appeared"] += 1
            if res != "U" and res != "UA":
                results_dict[sub]["passed"] += 1

    for sub in results_dict:
        if sub not in results_dict:
            continue
        # find total percentage
        total = results_dict[sub]["appeared"]
        if total == 0:
            results_dict[sub]["percentage"] = 0
        else:
            results_dict[sub]["percentage"] = (
                results_dict[sub]["passed"] / total
            ) * 100

    return results_dict


def parse_per_student(regNo):
    for result in results:
        regno = result.split(" ")[0]
        is_our_student = regno.startswith("812823")
        if not is_our_student:
            continue

        if regNo == regno:
            sub_res = result.split(" ")[-1:-10:-1][::-1]
            if regNo in ["812823205060", "812823205016", "812823205019"]:
                sub_res = result.split(" ")[-1:-12:-1][::-1]

            print(sub_res)
            subs = [
                # "CS3451",
                # "CS3452",
                # "CS3461",
                # "CS3481",
                # "CS3491",
                # "CS3492",
                # "GE3451",
                # "IT3401",
                # "NM1075",
                "CCS334",
                "CCS335",
                "CS3551",
                "CS3591",
                "CS3691",
                "IT3501",
                "IT3511",
                "MX3084",
                "NM1120",
            ]
            if regNo in ["812823205060", "812823205016", "812823205019"]:
                subs = [
                    "CCS334",
                    "CCS335",
                    "CCS360",  # open elective course
                    "CCS366",  # open elective course
                    "CS3551",
                    "CS3591",
                    "CS3691",
                    "IT3501",
                    "IT3511",
                    "MX3084",
                    "NM1120",
                ]
            print(subs, sub_res)

            return {subs[i]: sub_res[i] for i in range(len(subs))}


def print_results(results_dict, class_name=""):
    print(f"Aggregated Results for {class_name} students")
    headers = ["Subject Code", "Appeared", "Passed", "Percentage"]
    table = [
        [
            sub,
            results_dict[sub]["appeared"],
            results_dict[sub]["passed"],
            f"{results_dict[sub]['percentage']:.2f}%",
        ]
        for sub in results_dict
    ]
    print(tabulate(table, headers=headers, tablefmt="simple"))


def print_per_student_result(regNo, results):
    print(f"Results for student {regNo}")

    for sub, res in results.items():
        print(f"{sub}: {res}")

    # calculate_sgpa(4, results)
    print(f"SGPA: {calculate_sgpa(5, results):.2f}")


print_results(parse_results(_range=(0, 36)), class_name="E37A")
print_results(parse_results(_range=(37, 69)), class_name="E37B")

# sgpa_results = []

# all_clear = 0
# for i in range(1, 70):
#     regNo = f"8128232050{i:02d}"
#     res = parse_per_student(regNo)
#     if res:
#         for sub in res:
#             if res[sub] == "UA" or res[sub] == "U":
#                 break
#         else:
#             all_clear += 1

#         sgpa_results.append((calculate_sgpa(sem, res), regNo))
#         print(f"Results for student {regNo}:", end=" ")
#         print(f"SGPA: {calculate_sgpa(sem, res):.2f}")

# # print(f"All Clear: {all_clear}")
# sgpa_results.sort(reverse=True, key=lambda x: x[0])
# prev_rank = 1
# for i, (sgpa, regNo) in enumerate(sgpa_results):
#     # if same rank, give same rank to both students
#     if i == 0:
#         rank = 1
#     else:
#         prev_sgpa = sgpa_results[i - 1][0]
#         if sgpa == prev_sgpa:
#             rank = prev_rank
#         else:
#             rank = prev_rank + 1
#     prev_rank = rank
#     print(f"{rank}. Results for student {regNo}:", end=" ")
#     print(f"SGPA: {sgpa:.2f}")


def compare_students(regNo1, regNo2):
    res1 = parse_per_student(regNo1)
    res2 = parse_per_student(regNo2)
    if not res1 or not res2:
        print("One or both registration numbers not found.")
        return
    print(f"Comparison between {regNo1} and {regNo2}:")
    all_subjects = sorted(set(res1.keys()).union(res2.keys()))
    table = []
    for sub in all_subjects:
        r1 = grade_mapping.get(res1.get(sub, "NA"), "0")
        r2 = grade_mapping.get(res2.get(sub, "NA"), "0")
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
    headers = ["Subject", regNo1, regNo2, "Diff"]
    print(tabulate(table, headers=headers, tablefmt="simple"))

    sgpa1 = calculate_sgpa(sem, res1)
    sgpa2 = calculate_sgpa(sem, res2)
    sgpa_diff = sgpa1 - sgpa2
    print(f"\nSGPA {regNo1}: {sgpa1:.2f}")
    print(f"SGPA {regNo2}: {sgpa2:.2f}")
    print(f"SGPA Difference: {sgpa_diff:+.2f}")


# # Example usage:
compare_students("812823205060", "812823205054")


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
