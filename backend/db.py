from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterator

from backend.constants import RESULT_GRADES, RESULT_STATES

RESULT_STATE_SQL = ", ".join(f"'{value}'" for value in RESULT_STATES)
RESULT_GRADE_SQL = ", ".join(f"'{value}'" for value in RESULT_GRADES)

BASE_SCHEMA_SQL = f"""
CREATE TABLE IF NOT EXISTS EndSemesterExam (
    exam_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    result_date TEXT NOT NULL,
    semester_no INTEGER NOT NULL,
    department_code INTEGER NOT NULL,
    batch TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS EndSemesterExamResult (
    eser_id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    regno TEXT NOT NULL,
    studentName TEXT NOT NULL DEFAULT 'N/A',
    subjectCode TEXT NOT NULL,
    semNo INTEGER NOT NULL,
    semName TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN ({RESULT_STATE_SQL})),
    grade TEXT NOT NULL CHECK(grade IN ({RESULT_GRADE_SQL})),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES EndSemesterExam(exam_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exam_lookup
ON EndSemesterExam (semester_no, department_code, batch, result_date DESC, exam_id DESC);

CREATE INDEX IF NOT EXISTS idx_eser_partition
ON EndSemesterExamResult (regno, semNo, semName, subjectCode, eser_id DESC);

CREATE INDEX IF NOT EXISTS idx_eser_exam_subject
ON EndSemesterExamResult (exam_id, subjectCode);

CREATE INDEX IF NOT EXISTS idx_eser_grade
ON EndSemesterExamResult (grade);
"""

VIEWS_SQL = """
DROP VIEW IF EXISTS vw_eser_effective;
DROP VIEW IF EXISTS vw_eser_audit_ordered;

CREATE VIEW vw_eser_audit_ordered AS
SELECT
    eser.eser_id,
    eser.exam_id,
    exam.name AS exam_name,
    exam.result_date,
    exam.semester_no AS exam_semester_no,
    exam.department_code,
    exam.batch,
    eser.regno,
    eser.studentName,
    eser.subjectCode,
    eser.semNo,
    eser.semName,
    eser.state,
    eser.grade,
    eser.created_at,
    ROW_NUMBER() OVER (
        PARTITION BY eser.regno, eser.semNo, eser.semName, eser.subjectCode
        ORDER BY exam.result_date DESC, eser.eser_id DESC
    ) AS recency_rank
FROM EndSemesterExamResult AS eser
JOIN EndSemesterExam AS exam ON exam.exam_id = eser.exam_id;

CREATE VIEW vw_eser_effective AS
WITH ranked AS (
    SELECT
        ordered.*,
        ROW_NUMBER() OVER (
            PARTITION BY ordered.regno, ordered.semNo, ordered.subjectCode
            ORDER BY
                CASE WHEN ordered.grade = 'NC' THEN 1 ELSE 0 END ASC,
                ordered.result_date DESC,
                ordered.eser_id DESC
        ) AS effective_rank,
        SUM(CASE WHEN ordered.grade = 'NC' THEN 1 ELSE 0 END) OVER (
            PARTITION BY ordered.regno, ordered.semNo, ordered.subjectCode
        ) AS nc_event_count,
        COUNT(*) OVER (
            PARTITION BY ordered.regno, ordered.semNo, ordered.subjectCode
        ) AS audit_event_count
    FROM vw_eser_audit_ordered AS ordered
)
SELECT
    eser_id,
    exam_id,
    exam_name,
    result_date,
    exam_semester_no,
    department_code,
    batch,
    regno,
    studentName,
    subjectCode,
    semNo,
    semName,
    state,
    grade,
    created_at,
    recency_rank,
    nc_event_count,
    audit_event_count,
    CASE WHEN nc_event_count > 0 THEN 1 ELSE 0 END AS had_nc_events,
    CASE WHEN grade = 'NC' THEN 1 ELSE 0 END AS selected_nc
FROM ranked
WHERE effective_rank = 1;
"""

CACHE_SQL = """
DROP TABLE IF EXISTS EffectiveGradeCache;

CREATE TABLE EffectiveGradeCache (
    regno TEXT NOT NULL,
    studentName TEXT NOT NULL,
    semNo INTEGER NOT NULL,
    semName TEXT NOT NULL,
    subjectCode TEXT NOT NULL,
    grade TEXT NOT NULL,
    state TEXT NOT NULL,
    exam_id INTEGER NOT NULL,
    result_date TEXT NOT NULL,
    had_nc_events INTEGER NOT NULL,
    audit_event_count INTEGER NOT NULL,
    refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (regno, semNo, semName, subjectCode)
);
"""


class SQLiteResultRepository:
    def __init__(self, db_path: str | Path):
        self.db_path = Path(db_path)

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def initialize_schema(self):
        with self._connect() as conn:
            conn.executescript(BASE_SCHEMA_SQL)
            self._ensure_table_compatibility(conn)
            conn.executescript(VIEWS_SQL)
            conn.executescript(CACHE_SQL)

    def _ensure_table_compatibility(self, conn: sqlite3.Connection):
        columns = {
            str(row["name"])
            for row in conn.execute(
                "PRAGMA table_info(EndSemesterExamResult)"
            ).fetchall()
        }
        if "studentName" not in columns:
            conn.execute(
                "ALTER TABLE EndSemesterExamResult ADD COLUMN studentName TEXT NOT NULL DEFAULT 'N/A'"
            )

    def insert_exam(
        self,
        *,
        name: str,
        result_date: str | date | datetime,
        semester_no: int,
        department_code: int,
        batch: str,
    ) -> int:
        normalized_date = _normalize_result_date(result_date)

        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO EndSemesterExam
                (name, result_date, semester_no, department_code, batch)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    name.strip(),
                    normalized_date,
                    int(semester_no),
                    int(department_code),
                    batch.strip(),
                ),
            )
            if cur.lastrowid is None:
                raise RuntimeError("Failed to insert EndSemesterExam row")
            return int(cur.lastrowid)

    def insert_result_event(
        self,
        *,
        exam_id: int,
        regno: str,
        student_name: str = "N/A",
        subject_code: str,
        sem_no: int,
        sem_name: str,
        state: str,
        grade: str,
    ) -> int:
        normalized_state = state.strip().upper()
        normalized_grade = grade.strip().upper()

        if normalized_state not in RESULT_STATES:
            raise ValueError(f"Unsupported result state: {state}")

        if normalized_grade not in RESULT_GRADES:
            raise ValueError(f"Unsupported grade: {grade}")

        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO EndSemesterExamResult
                (exam_id, regno, studentName, subjectCode, semNo, semName, state, grade)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    int(exam_id),
                    regno.strip(),
                    (student_name.strip() or "N/A"),
                    subject_code.strip().upper(),
                    int(sem_no),
                    sem_name.strip(),
                    normalized_state,
                    normalized_grade,
                ),
            )
            if cur.lastrowid is None:
                raise RuntimeError("Failed to insert EndSemesterExamResult row")
            return int(cur.lastrowid)

    def get_audit_events(
        self,
        *,
        regno: str,
        sem_no: int,
        sem_name: str,
        subject_code: str | None = None,
    ) -> list[dict[str, Any]]:
        where = ["regno = ?", "semNo = ?", "semName = ?"]
        params: list[Any] = [regno.strip(), int(sem_no), sem_name.strip()]

        if subject_code:
            where.append("subjectCode = ?")
            params.append(subject_code.strip().upper())

        query = f"""
            SELECT *
            FROM vw_eser_audit_ordered
            WHERE {" AND ".join(where)}
            ORDER BY result_date DESC, eser_id DESC
        """

        with self._connect() as conn:
            rows = conn.execute(query, params).fetchall()
            return [dict(row) for row in rows]

    def get_student_audit_for_semester(
        self,
        *,
        regno: str,
        sem_no: int,
        department_code: int,
        batch: str,
    ) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT
                    eser_id,
                    exam_id,
                    exam_name,
                    result_date,
                    department_code,
                    batch,
                    regno,
                    studentName,
                    subjectCode,
                    semNo,
                    semName,
                    state,
                    grade,
                    recency_rank
                FROM vw_eser_audit_ordered
                WHERE regno = ?
                  AND semNo = ?
                  AND department_code = ?
                  AND batch = ?
                ORDER BY subjectCode ASC, result_date DESC, eser_id DESC
                """,
                (
                    regno.strip(),
                    int(sem_no),
                    int(department_code),
                    str(batch).strip(),
                ),
            ).fetchall()
            return [dict(row) for row in rows]

    def get_effective_results(
        self,
        *,
        regno: str,
        sem_no: int,
        sem_name: str | None = None,
    ) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT *
                FROM vw_eser_effective
                WHERE regno = ? AND semNo = ?
                ORDER BY subjectCode ASC
                """,
                (regno.strip(), int(sem_no)),
            ).fetchall()
            return [dict(row) for row in rows]

    def get_effective_grade_map(
        self,
        *,
        regno: str,
        sem_no: int,
        sem_name: str | None = None,
    ) -> dict[str, str]:
        rows = self.get_effective_results(regno=regno, sem_no=sem_no, sem_name=sem_name)
        return {str(row["subjectCode"]): str(row["grade"]) for row in rows}

    def get_effective_grade_map_for_semester(
        self,
        *,
        regno: str,
        sem_no: int,
        department_code: int,
        batch: str | None = None,
    ) -> dict[str, str]:
        where = ["regno = ?", "semNo = ?", "department_code = ?"]
        params: list[Any] = [regno.strip(), int(sem_no), int(department_code)]

        if batch is not None:
            where.append("batch = ?")
            params.append(str(batch).strip())

        query = f"""
            SELECT subjectCode, grade
            FROM vw_eser_effective
            WHERE {" AND ".join(where)}
            ORDER BY subjectCode ASC
        """

        with self._connect() as conn:
            rows = conn.execute(query, params).fetchall()
            return {str(row["subjectCode"]): str(row["grade"]) for row in rows}

    def refresh_effective_grade_cache(self):
        with self._connect() as conn:
            conn.execute("DELETE FROM EffectiveGradeCache")
            conn.execute(
                """
                INSERT INTO EffectiveGradeCache
                (regno, studentName, semNo, semName, subjectCode, grade, state, exam_id, result_date, had_nc_events, audit_event_count)
                SELECT
                    regno,
                    studentName,
                    semNo,
                    semName,
                    subjectCode,
                    grade,
                    state,
                    exam_id,
                    result_date,
                    had_nc_events,
                    audit_event_count
                FROM vw_eser_effective
                """
            )

    def get_effective_results_from_cache(
        self,
        *,
        regno: str,
        sem_no: int,
        sem_name: str | None = None,
    ) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT *
                FROM EffectiveGradeCache
                WHERE regno = ? AND semNo = ?
                ORDER BY subjectCode ASC
                """,
                (regno.strip(), int(sem_no)),
            ).fetchall()
            return [dict(row) for row in rows]

    def get_available_department_codes(self) -> list[int]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT DISTINCT department_code
                FROM EndSemesterExam
                ORDER BY department_code ASC
                """
            ).fetchall()
            return [int(row["department_code"]) for row in rows]

    def get_available_semesters(
        self, *, department_code: int | None = None
    ) -> list[int]:
        params: list[Any] = []
        where: list[str] = []
        if department_code is not None:
            where.append("department_code = ?")
            params.append(int(department_code))

        query = "SELECT DISTINCT semester_no FROM EndSemesterExam"
        if where:
            query += f" WHERE {' AND '.join(where)}"
        query += " ORDER BY semester_no ASC"

        with self._connect() as conn:
            rows = conn.execute(query, params).fetchall()
            return [int(row["semester_no"]) for row in rows]

    def get_available_batches(
        self,
        *,
        semester_no: int | None = None,
        department_code: int | None = None,
    ) -> list[str]:
        params: list[Any] = []
        where: list[str] = []

        if semester_no is not None:
            where.append("semester_no = ?")
            params.append(int(semester_no))

        if department_code is not None:
            where.append("department_code = ?")
            params.append(int(department_code))

        query = "SELECT DISTINCT batch FROM EndSemesterExam"
        if where:
            query += f" WHERE {' AND '.join(where)}"
        query += " ORDER BY CAST(batch AS INTEGER) DESC, batch DESC"

        with self._connect() as conn:
            rows = conn.execute(query, params).fetchall()
            return [str(row["batch"]) for row in rows]

    def resolve_latest_batch(
        self, *, semester_no: int, department_code: int
    ) -> str | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT batch
                FROM EndSemesterExam
                WHERE semester_no = ? AND department_code = ?
                ORDER BY CAST(batch AS INTEGER) DESC, batch DESC, result_date DESC, exam_id DESC
                LIMIT 1
                """,
                (int(semester_no), int(department_code)),
            ).fetchone()
            return str(row["batch"]) if row else None

    def resolve_latest_sem_name(
        self,
        *,
        semester_no: int,
        department_code: int,
        batch: str,
    ) -> str | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT semName
                FROM vw_eser_audit_ordered
                WHERE semNo = ? AND department_code = ? AND batch = ?
                ORDER BY result_date DESC, exam_id DESC, eser_id DESC
                LIMIT 1
                """,
                (int(semester_no), int(department_code), str(batch).strip()),
            ).fetchone()
            return str(row["semName"]) if row else None

    def load_semester_effective_results(
        self,
        *,
        semester_no: int,
        department_code: int,
        batch: str | None = None,
        sem_name: str | None = None,
    ) -> tuple[list[dict[str, Any]], str | None, str | None]:
        selected_batch = (
            str(batch).strip()
            if batch
            else self.resolve_latest_batch(
                semester_no=int(semester_no),
                department_code=int(department_code),
            )
        )
        if not selected_batch:
            return [], None, None

        selected_sem_name = sem_name.strip() if sem_name and sem_name.strip() else None

        where_sql = """
                WHERE semNo = ?
                  AND department_code = ?
                  AND batch = ?
        """
        params: list[Any] = [
            int(semester_no),
            int(department_code),
            selected_batch,
        ]
        if selected_sem_name:
            where_sql += " AND semName = ?"
            params.append(selected_sem_name)

        with self._connect() as conn:
            rows = conn.execute(
                f"""
                SELECT
                    regno,
                    COALESCE(NULLIF(MAX(TRIM(studentName)), ''), 'N/A') AS studentName,
                    subjectCode,
                    grade
                FROM vw_eser_effective
                {where_sql}
                GROUP BY regno, subjectCode
                ORDER BY regno ASC, subjectCode ASC
                """,
                params,
            ).fetchall()

        by_regno: dict[str, dict[str, Any]] = {}
        for row in rows:
            regno = str(row["regno"])
            student_name = str(row["studentName"] or "N/A").strip() or "N/A"
            subject_code = str(row["subjectCode"])
            grade = str(row["grade"])

            entry = by_regno.setdefault(
                regno,
                {
                    "regno": regno,
                    "name": student_name,
                    "subjects": {},
                },
            )
            if entry["name"] == "N/A" and student_name != "N/A":
                entry["name"] = student_name
            entry["subjects"][subject_code] = grade

        ordered = [by_regno[key] for key in sorted(by_regno)]
        return ordered, selected_batch, selected_sem_name

    def load_multiple_semester_effective_results(
        self,
        *,
        semesters: list[int],
        department_code: int,
        batch: str | None = None,
    ) -> tuple[dict[int, list[dict[str, Any]]], dict[int, str]]:
        results_by_semester: dict[int, list[dict[str, Any]]] = {}
        sources: dict[int, str] = {}

        for semester in semesters:
            rows, resolved_batch, resolved_sem_name = (
                self.load_semester_effective_results(
                    semester_no=int(semester),
                    department_code=int(department_code),
                    batch=batch,
                    sem_name=None,
                )
            )
            if not rows:
                raise LookupError(
                    f"No SQLite data for semester {semester}, department_code {department_code}"
                    + (f", batch {batch}" if batch else "")
                )

            results_by_semester[int(semester)] = rows
            sources[int(semester)] = (
                f"sqlite(batch={resolved_batch}, sem_name={resolved_sem_name})"
            )

        return results_by_semester, sources


def _normalize_result_date(value: str | date | datetime) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()

    if isinstance(value, date):
        return value.isoformat()

    normalized = str(value).strip()
    if not normalized:
        raise ValueError("result_date cannot be empty")

    try:
        datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError(
            "result_date must be ISO format (YYYY-MM-DD or datetime)"
        ) from exc

    return normalized
