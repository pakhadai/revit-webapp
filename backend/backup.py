# backend/backup.py
import os
import shutil
import gzip
import logging
from datetime import datetime
from pathlib import Path

# --- Налаштування ---
DB_FILE = Path(__file__).parent / "database" / "database.db"
BACKUP_DIR = Path(__file__).parent / "backups"
RETENTION_DAYS = 7  # Скільки днів зберігати бекапи
# --------------------

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')


def create_backup():
    if not DB_FILE.exists():
        logging.error(f"Database file not found at {DB_FILE}")
        return

    BACKUP_DIR.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    backup_filename = f"database_backup_{timestamp}.db.gz"
    backup_path = BACKUP_DIR / backup_filename

    logging.info(f"Starting backup of {DB_FILE} to {backup_path}...")

    try:
        with open(DB_FILE, 'rb') as f_in:
            with gzip.open(backup_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        logging.info("Backup created successfully.")
    except Exception as e:
        logging.error(f"Failed to create backup: {e}")


def cleanup_old_backups():
    now = datetime.now()
    cutoff = now - timedelta(days=RETENTION_DAYS)

    logging.info(f"Cleaning up backups older than {RETENTION_DAYS} days...")

    for f in BACKUP_DIR.glob("*.db.gz"):
        file_time = datetime.fromtimestamp(f.stat().st_mtime)
        if file_time < cutoff:
            try:
                f.unlink()
                logging.info(f"Deleted old backup: {f.name}")
            except Exception as e:
                logging.error(f"Failed to delete {f.name}: {e}")

    logging.info("Cleanup complete.")


if __name__ == "__main__":
    create_backup()
    cleanup_old_backups()