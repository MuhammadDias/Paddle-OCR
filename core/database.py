import os
import sqlite3
import json
import logging
from datetime import datetime
from pathlib import Path

logger = logging.getLogger("ai_ocr_system.database")

# Database path in the root folder
BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "ocr_system.db"

def get_db_connection():
    """Create a connection to the SQLite database."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database tables for users and OCR history."""
    logger.info("Initializing database schema at %s", DB_PATH)
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create ocr_history table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ocr_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                ocr_result TEXT NOT NULL, -- JSON string containing the full OCRResponse
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        
        # Index on created_at for fast cleanup
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_history_created_at ON ocr_history(created_at)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
        
        conn.commit()
        logger.info("Database schema initialized successfully.")
    except Exception as exc:
        logger.exception("Failed to initialize database: %s", exc)
        raise
    finally:
        conn.close()

# User CRUD operations
def create_user(email: str, hashed_pw: str) -> int:
    """Create a new user in the database."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (email, hashed_password) VALUES (?, ?)",
            (email.strip().lower(), hashed_pw)
        )
        conn.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        raise ValueError("Email sudah terdaftar.")
    finally:
        conn.close()

def get_user_by_email(email: str):
    """Retrieve user record by email address."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM users WHERE email = ?",
            (email.strip().lower(),)
        )
        return cursor.fetchone()
    finally:
        conn.close()

# History CRUD operations
def add_history(user_id: int, filename: str, ocr_result_dict: dict):
    """Insert a new OCR history record for a user."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        ocr_result_json = json.dumps(ocr_result_dict)
        cursor.execute(
            "INSERT INTO ocr_history (user_id, filename, ocr_result) VALUES (?, ?, ?)",
            (user_id, filename, ocr_result_json)
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()

def get_history(user_id: int) -> list[dict]:
    """Get all history entries for a user, sorted by date (newest first)."""
    # Clean up old records before fetching to keep it correct
    delete_old_history()
    
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, filename, ocr_result, created_at FROM ocr_history WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        )
        rows = cursor.fetchall()
        
        history_list = []
        for row in rows:
            try:
                result_data = json.loads(row["ocr_result"])
                history_list.append({
                    "id": row["id"],
                    "filename": row["filename"],
                    "ocr_result": result_data,
                    "created_at": row["created_at"]
                })
            except Exception as e:
                logger.error("Failed to parse history JSON for ID %d: %s", row["id"], e)
                continue
                
        return history_list
    finally:
        conn.close()

def delete_old_history() -> int:
    """Delete history records older than 1 day (24 hours)."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        # Delete entries where created_at is older than 24 hours
        cursor.execute(
            "DELETE FROM ocr_history WHERE created_at < datetime('now', '-1 day')"
        )
        deleted_count = cursor.rowcount
        if deleted_count > 0:
            conn.commit()
            logger.info("Auto-deleted %d expired OCR history records (> 24 hours).", deleted_count)
        return deleted_count
    except Exception as exc:
        logger.error("Failed to clean up expired history: %s", exc)
        return 0
    finally:
        conn.close()
