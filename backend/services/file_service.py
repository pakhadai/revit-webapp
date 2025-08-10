# backend/services/file_service.py
import os
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, Tuple
from pathlib import Path
import aiofiles
import zipfile
from config import settings
import logging

logger = logging.getLogger(__name__)


class FileService:
    """Сервіс для роботи з файлами архівів"""

    def __init__(self):
        self.downloads_cache = {}  # Кеш тимчасових посилань
        self.setup_directories()

    def setup_directories(self):
        """Створити необхідні директорії"""
        directories = [
            settings.PREMIUM_ARCHIVES_DIR,
            settings.FREE_ARCHIVES_DIR,
            settings.MEDIA_DIR / "temp",
            settings.MEDIA_DIR / "previews"
        ]

        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)

    def generate_download_token(self, user_id: int, archive_id: int, expires_minutes: int = 60) -> str:
        """Генерувати токен для завантаження"""
        # Створюємо унікальний токен
        token_data = f"{user_id}:{archive_id}:{datetime.utcnow().isoformat()}"
        token_hash = hashlib.sha256(token_data.encode()).hexdigest()
        token = secrets.token_urlsafe(32)

        # Зберігаємо в кеш з терміном дії
        self.downloads_cache[token] = {
            "user_id": user_id,
            "archive_id": archive_id,
            "expires_at": datetime.utcnow() + timedelta(minutes=expires_minutes),
            "hash": token_hash,
            "downloads": 0,
            "max_downloads": 3  # Максимум завантажень по одному токену
        }

        return token

    def validate_download_token(self, token: str) -> Optional[dict]:
        """Перевірити токен завантаження"""
        if token not in self.downloads_cache:
            return None

        token_data = self.downloads_cache[token]

        # Перевіряємо термін дії
        if datetime.utcnow() > token_data["expires_at"]:
            del self.downloads_cache[token]
            return None

        # Перевіряємо кількість завантажень
        if token_data["downloads"] >= token_data["max_downloads"]:
            del self.downloads_cache[token]
            return None

        return token_data

    async def get_archive_file_path(self, archive_code: str, archive_type: str) -> Optional[Path]:
        """Отримати шлях до файлу архіву"""
        # Визначаємо директорію
        if archive_type == "premium":
            base_dir = settings.PREMIUM_ARCHIVES_DIR
        else:
            base_dir = settings.FREE_ARCHIVES_DIR

        # Шукаємо файл
        possible_extensions = ['.zip', '.rar', '.7z', '.rfa']

        for ext in possible_extensions:
            file_path = base_dir / f"{archive_code}{ext}"
            if file_path.exists():
                return file_path

        # Якщо є папка з файлами - створюємо zip
        folder_path = base_dir / archive_code
        if folder_path.exists() and folder_path.is_dir():
            return await self.create_zip_from_folder(folder_path, archive_code)

        return None

    async def create_zip_from_folder(self, folder_path: Path, archive_code: str) -> Path:
        """Створити ZIP архів з папки"""
        temp_dir = settings.MEDIA_DIR / "temp"
        zip_path = temp_dir / f"{archive_code}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.zip"

        # Створюємо ZIP
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(folder_path):
                for file in files:
                    file_path = Path(root) / file
                    arcname = file_path.relative_to(folder_path.parent)
                    zipf.write(file_path, arcname)

        logger.info(f"Created ZIP archive: {zip_path}")
        return zip_path

    async def get_file_info(self, file_path: Path) -> dict:
        """Отримати інформацію про файл"""
        if not file_path.exists():
            return None

        stats = file_path.stat()

        # Визначаємо тип файлу
        extension = file_path.suffix.lower()
        mime_types = {
            '.zip': 'application/zip',
            '.rar': 'application/x-rar-compressed',
            '.7z': 'application/x-7z-compressed',
            '.rfa': 'application/octet-stream'
        }

        return {
            "filename": file_path.name,
            "size": stats.st_size,
            "size_mb": round(stats.st_size / (1024 * 1024), 2),
            "mime_type": mime_types.get(extension, 'application/octet-stream'),
            "modified": datetime.fromtimestamp(stats.st_mtime).isoformat(),
            "extension": extension
        }

    def cleanup_expired_tokens(self):
        """Очистити прострочені токени"""
        now = datetime.utcnow()
        expired = [
            token for token, data in self.downloads_cache.items()
            if data["expires_at"] < now
        ]

        for token in expired:
            del self.downloads_cache[token]

        if expired:
            logger.info(f"Cleaned up {len(expired)} expired download tokens")

    def cleanup_temp_files(self):
        """Очистити тимчасові файли"""
        temp_dir = settings.MEDIA_DIR / "temp"

        # Видаляємо файли старші 24 годин
        cutoff = datetime.utcnow() - timedelta(hours=24)

        for file_path in temp_dir.glob("*"):
            if file_path.is_file():
                stats = file_path.stat()
                if datetime.fromtimestamp(stats.st_mtime) < cutoff:
                    file_path.unlink()
                    logger.info(f"Deleted temp file: {file_path}")

    async def create_preview(self, archive_id: int, file_path: Path) -> Optional[Path]:
        """Створити превью для архіву (список файлів)"""
        preview_dir = settings.MEDIA_DIR / "previews"
        preview_path = preview_dir / f"preview_{archive_id}.txt"

        try:
            if file_path.suffix.lower() == '.zip':
                with zipfile.ZipFile(file_path, 'r') as zipf:
                    file_list = zipf.namelist()

                    # Створюємо структуру дерева
                    tree_structure = self._create_tree_structure(file_list)

                    async with aiofiles.open(preview_path, 'w', encoding='utf-8') as f:
                        await f.write(f"Archive: {file_path.name}\n")
                        await f.write(f"Files: {len(file_list)}\n")
                        await f.write(f"Size: {self._format_size(file_path.stat().st_size)}\n")
                        await f.write("\n" + "=" * 50 + "\n\n")
                        await f.write("Content:\n\n")
                        await f.write(tree_structure)

                return preview_path

        except Exception as e:
            logger.error(f"Failed to create preview: {e}")
            return None

    def _create_tree_structure(self, file_list: list) -> str:
        """Створити деревоподібну структуру файлів"""
        tree = {}

        # Будуємо дерево
        for path in sorted(file_list):
            parts = path.split('/')
            current = tree

            for part in parts[:-1]:
                if part not in current:
                    current[part] = {}
                current = current[part]

            # Додаємо файл
            if parts[-1]:  # Ігноруємо порожні
                current[parts[-1]] = None

        # Конвертуємо в текст
        return self._tree_to_string(tree)

    def _tree_to_string(self, tree: dict, prefix: str = "", is_last: bool = True) -> str:
        """Конвертувати дерево в текстовий вигляд"""
        result = []
        items = list(tree.items())

        for i, (name, subtree) in enumerate(items):
            is_last_item = (i == len(items) - 1)

            # Символи для дерева
            if prefix == "":
                current_prefix = ""
                child_prefix = ""
            else:
                current_prefix = prefix + ("└── " if is_last_item else "├── ")
                child_prefix = prefix + ("    " if is_last_item else "│   ")

            result.append(current_prefix + name)

            # Рекурсивно для папок
            if subtree is not None:
                result.append(self._tree_to_string(subtree, child_prefix, is_last_item))

        return "\n".join(filter(None, result))

    def _format_size(self, size_bytes: int) -> str:
        """Форматувати розмір файлу"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f} TB"


# Створюємо глобальний екземпляр
file_service = FileService()
