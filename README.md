# AUResultsParser

A Python utility for parsing and analyzing academic results from university PDF documents. This tool extracts student grades, calculates SGPA, generates rank lists, and provides comprehensive result summaries.

## Features

- **PDF Extraction**: Extract student results directly from university PDF documents
- **Multi-semester Support**: Parse results from multiple semesters (3, 4, 5, 7)
- **Department Support**: Handle results from different departments (IT, AIML)
- **Grade Analysis**: Calculate SGPA and analyze student performance
- **Rank Lists**: Generate rank lists based on student performance
- **Result Summaries**: Generate comprehensive summaries at multiple levels:
  - Semester-wise summaries
  - Subject-wise summaries
  - Overall student summaries
  - Comparative analysis between students
- **JSON Storage**: Save and load parsed results in JSON format for easy processing

## Requirements

- Python >= 3.13
- pdfplumber >= 0.11.9
- pymupdf >= 1.27.2
- pypdf >= 6.0.0
- tabulate >= 0.10.0

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd AUResultsParser
```

2. Install dependencies using uv (or pip):

```bash
uv sync
```

Or with pip:

```bash
pip install -e .
```

## Project Structure

```
AUResultsParser/
├── main.py                          # Interactive CLI for result analysis
├── new_parser.py                    # Core result extraction and processing
├── result.py                        # Result calculation utilities (SGPA, grades)
├── pyproject.toml                   # Project configuration
└── README.md                        # This file
```

## Usage

### Interactive Mode

Run the interactive CLI to analyze results:

```bash
python main.py
```

The interactive mode will prompt you to:

1. Select a department (IT or AIML)
2. Select semesters to analyze
3. Choose between viewing overall or department-wise summaries

### Programmatic Usage

#### Extract Results from PDF

```python
from new_parser import extract_results, store_results
from result import subject_sem_mapping

def get_subjects_for_semester(semester: int) -> list[str]:
    return [sub for sub, sem in subject_sem_mapping.items() if sem == semester]

# Extract results
results = extract_results(
    regno_slug="812822205",
    recognized_subjects=sorted(get_subjects_for_semester(7)),
    semester=7,
    file="results.pdf"
)

# Store results to JSON
if results:
    store_results(results, "semester_7_results.json")
```

#### Load and Analyze Results

```python
from new_parser import (
    load_results,
    get_sem_result_summary,
    get_student_results,
    get_overall_summary,
    generate_rank_list
)

# Load results from JSON
results = load_results("semester_7_results.json")

# Get semester summary
sem_summary = get_sem_result_summary(results)
print(sem_summary)

# Get specific student results
student_results = get_student_results(results, "812822205")

# Generate overall summary with rankings
overall_summary = get_overall_summary(results)

# Generate rank list
rank_list = generate_rank_list(results)
```

### Key Functions

#### new_parser.py

- `extract_results()`: Extract results from PDF document
- `store_results()`: Save results to JSON file
- `load_results()`: Load results from JSON file
- `get_sem_result_summary()`: Get semester-wise summary statistics
- `get_student_results()`: Get results for a specific student
- `get_overall_summary()`: Get overall analysis with rankings
- `generate_rank_list()`: Generate ranked list of students
- `get_subject_wise_summary()`: Get subject-wise performance analysis
- `compare_results_students()`: Compare results between students

#### result.py

- `calculate_sgpa()`: Calculate SGPA (Semester Grade Point Average)
- `subject_credit_mapping`: Mapping of subjects to their credit values
- `subject_sem_mapping`: Mapping of subjects to their semester
- `dept_codes`: Department code mapping (AIML=148, IT=205)

## Configuration

The following mappings can be customized in `result.py`:

### Department Codes

```python
dept_codes = {
    "AIML": 148,
    "IT": 205,
}
```

### Subject Credit Mapping

Configure credit values for each subject:

```python
subject_credit_mapping = {
    "GE3791": 2,
    "AI3021": 3,
    # ... more subjects
}
```

### Subject Semester Mapping

Configure which semester each subject belongs to:

```python
subject_sem_mapping = {
    "GE3791": 7,
    "AI3021": 7,
    # ... more subjects
}
```

## Grade Mapping

The tool uses standard university grading scales. Refer to `result.py` for the specific grade-to-point mappings used in SGPA calculations.

## Error Handling

The tool handles various error cases:

- Missing PDF files
- Invalid registration number slugs
- Missing page content
- Malformed or missing tables in PDFs
- No results found for given criteria

## Supported PDF Formats

The parser is designed to work with university PDF result documents that contain:

- Tabular data with student registration numbers
- Subject codes and corresponding grades
- Semester information in the document
- Standard table structure with headers

## Limitations

- PDF parsing is dependent on consistent formatting in source documents
- Subject codes and semester mappings must be pre-configured
- Requires valid registration number slugs to extract specific student results

## Dependencies

- **pdfplumber**: PDF text and table extraction
- **tabulate**: Pretty-print tabular data

## Contributing

When adding new features:

1. Update subject/semester mappings in `result.py` as needed
2. Add test cases with sample data
3. Update this README with new functionality

## License

Licensed under Sairam Free License (SFL).

## Author

Sairam Mangeshkar (2025-present)
