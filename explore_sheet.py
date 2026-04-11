import pdfplumber
import re

COLLEGE_CODE = "8128"

REGNO_REGEX = re.compile(
    r"\d{4}(\d{2})\d{3}\d{3}"  # matches 812823205060 and captures "23" as the batch
)

SEM_REGEX = re.compile(r"(Semester|Sem)\s+(No)?\.*\s*:\s*+(?P<sem>\d+)", re.IGNORECASE)


def get_result_pdf_data(pdf_file: str):
    batches_by_sem: dict[int, set[int]] = {}
    pages_by_sem_batch: dict[tuple[int, int], set[int]] = {}

    with pdfplumber.open(pdf_file) as pdf:
        current_sem = None
        for page in pdf.pages:
            text = page.extract_text()

            if text:
                lines = text.split("\n")
                for line in lines:
                    if "Semester" in line:
                        # only take the Semester part, eg: "Semester No. : 01" -> "1", use regex to extract the number after "Semester No. :"

                        match = SEM_REGEX.search(line)
                        if match:
                            current_sem = int(match.group("sem") or "0")

            table = page.extract_table()
            batches_found = set()
            if table:
                for row in table:
                    # fetch the first cell
                    if row and len(row) > 0:
                        first_cell = row[0]
                        if first_cell and COLLEGE_CODE in first_cell:
                            batch_match = REGNO_REGEX.search(first_cell)
                            if batch_match:
                                batch = int(batch_match.group(1))
                                batches_found.add(batch)
            print(
                f"Page {page.page_number}: Sem {current_sem}, Batches: {batches_found}"
            )
            if current_sem is not None:
                for batch in batches_found:
                    pages_by_sem_batch[(current_sem, batch)] = pages_by_sem_batch.get(
                        (current_sem, batch), set()
                    ) | {page.page_number}
                if current_sem not in batches_by_sem:
                    batches_by_sem[current_sem] = set()
                batches_by_sem[current_sem].update(batches_found)

    sorted_batches: dict[int, list[int]] = {
        sem: sorted(list(batches)) for sem, batches in batches_by_sem.items()
    }
    semesters_found = sorted(sorted_batches.keys())

    return semesters_found, sorted_batches, pages_by_sem_batch


if __name__ == "__main__":
    pdf_file = "205_ND2023.pdf"
    semesters, batches, pages = get_result_pdf_data(pdf_file)
    print("Semesters found:")
    for semester in semesters:
        print(semester)
    print("\nBatches found:")
    for batch in batches:
        print(batch, batches[batch])
    print("\nPages found:")
    for (sem, batch), page_numbers in pages.items():
        print(f"Sem {sem}, Batch {batch}: {page_numbers}")
