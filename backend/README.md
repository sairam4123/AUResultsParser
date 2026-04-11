Interactive PDF ingestion
=========================

Run the interactive ingestion app:

python -m backend.interactive_pdf_ingestion

What it does:
- Loads all PDFs available in the project root.
- Lets you select one PDF and scans it for all semester and batch combinations.
- Builds an ingest-all plan by default (full ingestion for all discovered combinations).
- Auto-derives sem_name from exam cycle hints in PDF/exam name and result date.
	ND maps to ODD and AM maps to EVEN, and the same sem_name is applied across all batches.
	Example: both batch 2023 sem 5 and batch 2024 sem 3 in ND2025 map to 25-ODD.
- Lets you optionally edit sem_name values before ingest.


API versioning
==============

- Legacy JSON API is available under /api/v1/*.
- New SQLite source-of-truth API is available under /api/v2/*.
- Existing /api/* routes continue to point to the legacy implementation for compatibility.

SQLite DB path resolution order:
- AU_RESULTS_DB_PATH environment variable (if set)
- results.sqlite in project root
- results.sqlite3 in project root (legacy fallback)

You can quickly verify v2 is SQLite-backed by calling:
- GET /api/v2/meta
- GET /api/v2/summary?semester=5&department=IT


PDF ingestion notes
===================

- Use `python -m backend.pdf_ingestion --debug ...` to print ingestion diagnostics.
- For sparse `REVAL`/`CHALLENGE` PDFs, you can optionally carry forward missing subjects from
	existing effective grades (same regno/semester/batch).
- This behavior is disabled by default. Enable it with `--expand-with-effective-subjects` in
	direct CLI mode, or `"expand_with_effective_subjects": true` in config jobs.
