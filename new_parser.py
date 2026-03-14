import pdfplumber


def extract_results(
    regno_slug: str,
    recognized_subjects: list[str],
    semester: int = 5,
    file: str = "205_ND2025.pdf",
) -> list[dict[str, str | dict[str, str]]] | None:
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
