"""
Local SQLite storage for user feedback (thumbs up/down) on AI analyses.

Note: this is local, ephemeral feedback for product improvement purposes,
not a system of record. On most container-based deployments (Render, Cloud
Run, etc.) the filesystem is NOT persistent across deploys/restarts, so
this data should be treated as best-effort, not durable.
"""

import os
import sqlite3
from contextlib import contextmanager

# Use an absolute path next to this file rather than a relative path, so
# feedback always lands in the same place regardless of the working
# directory the process happens to be launched from.
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "feedback.db")


@contextmanager
def _get_connection():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vendor_name TEXT,
                filename TEXT,
                is_positive BOOLEAN,
                comments TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()


def log_feedback(vendor_name: str, filename: str, is_positive: bool, comments: str = "") -> bool:
    """Returns True on success, False on failure (never raises - feedback
    logging should never be allowed to crash the report flow)."""
    try:
        with _get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO feedback (vendor_name, filename, is_positive, comments)
                VALUES (?, ?, ?, ?)
            ''', (vendor_name, filename, is_positive, comments))
            conn.commit()
        return True
    except Exception:
        return False


def get_feedback_stats() -> dict:
    """Returns aggregate counts; used for an optional admin/debug view."""
    try:
        with _get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*), SUM(is_positive) FROM feedback")
            total, positive = cursor.fetchone()
            total = total or 0
            positive = positive or 0
            return {"total": total, "positive": positive, "negative": total - positive}
    except Exception:
        return {"total": 0, "positive": 0, "negative": 0}
