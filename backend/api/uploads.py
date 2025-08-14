# backend/api/uploads_enhanced.py
"""
Розширена система завантаження файлів з валідацією та оптимізацією
Замініть backend/api/uploads.py цим файлом
"""

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from PIL import Image
from typing import List, Optional
import os
import uuid
import shutil
import aiofiles
from pathlib import Path
import zipfile
import logging

from database import get_session
from models.user import User
from models.archive import Archive
from api.dependencies import get_current_user_dependency, admin_required
from config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Константи
UPLOAD_DIR = Path("media")
ARCHIVE_DIR = UPLOAD_DIR / "archives"
IMAGE_DIR = UPLOAD_DIR / "images"
TEMP_DIR = UPLOAD_DIR / "temp"
PREVIEW_DIR = UPLOAD_DIR / "previews"

# Обмеження
MAX_ARCHIVE_SIZE = 100 * 1024 * 1024  # 100MB
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_IMAGES_PER_PRODUCT = 10
ALLOWED_ARCHIVE_EXTENSIONS = {".zip", ".rar", ".7z"}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
IMAGE_SIZES = {
    "thumbnail": (150, 150),
    "preview": (400, 400),
    "full": (1200, 1200)
}

# Створюємо необхідні папки
for directory in [ARCHIVE_DIR, IMAGE_DIR, TEMP_DIR, PREVIEW_DIR]:
    directory.mkdir(parents=True, exist_ok=True)


class FileUploadService:
    """Сервіс для роботи з файлами"""

    @staticmethod
    def generate_filename(original_filename: str) -> str:
        """Генерує унікальне ім'я файлу"""
        ext = Path(original_filename).suffix.lower()
        return f"{uuid.uuid4().hex}{ext}"

    @staticmethod
    def validate_file_extension(filename: str, allowed_extensions: set) -> bool:
        """Перевіряє розширення файлу"""
        ext = Path(filename).suffix.lower()
        return ext in allowed_extensions

    @staticmethod
    async def save_uploaded_file(
            upload_file: UploadFile,
            destination: Path,
            max_size: int
    ) -> dict:
        """Зберігає завантажений файл"""
        # Перевірка розміру
        contents = await upload_file.read()
        file_size = len(contents)

        if file_size > max_size:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size: {max_size // 1024 // 1024}MB"
            )

        # Збереження
        async with aiofiles.open(destination, 'wb') as f:
            await f.write(contents)

        return {
            "path": str(destination),
            "size": file_size,
            "original_name": upload_file.filename
        }

    @staticmethod
    async def process_image(
            image_path: Path,
            sizes: dict = IMAGE_SIZES
    ) -> dict:
        """Обробляє зображення: створює різні розміри"""
        processed_images = {}

        try:
            with Image.open(image_path) as img:
                # Конвертуємо в RGB якщо потрібно
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')

                for size_name, dimensions in sizes.items():
                    # Створюємо папку для розміру
                    size_dir = IMAGE_DIR / size_name
                    size_dir.mkdir(exist_ok=True)

                    # Ресайз зображення
                    img_copy = img.copy()
                    img_copy.thumbnail(dimensions, Image.Resampling.LANCZOS)

                    # Зберігаємо
                    output_path = size_dir / image_path.name
                    img_copy.save(output_path, "JPEG", quality=85, optimize=True)

                    processed_images[size_name] = str(output_path)

        except Exception as e:
            logger.error(f"Error processing image: {e}")
            raise HTTPException(status_code=500, detail="Error processing image")

        return processed_images

    @staticmethod
    async def extract_archive_preview(archive_path: Path) -> dict:
        """Витягує превью архіву (список файлів)"""
        preview_data = {
            "file_count": 0,
            "total_size": 0,
            "file_list": [],
            "structure": {}
        }

        try:
            if archive_path.suffix.lower() == '.zip':
                with zipfile.ZipFile(archive_path, 'r') as zf:
                    for info in zf.infolist():
                        preview_data["file_list"].append(info.filename)
                        preview_data["total_size"] += info.file_size
                    preview_data["file_count"] = len(zf.namelist())

                    # Створюємо структуру папок
                    for name in zf.namelist():
                        parts = name.split('/')
                        current = preview_data["structure"]
                        for part in parts[:-1]:
                            if part not in current:
                                current[part] = {}
                            current = current[part]
                        if parts[-1]:  # Не пуста назва файлу
                            current[parts[-1]] = None

        except Exception as e:
            logger.error(f"Error extracting archive preview: {e}")

        return preview_data


# Ініціалізуємо сервіс
file_service = FileUploadService()


@router.post("/archive/multipart")
async def upload_archive_multipart(
        file: UploadFile = File(...),
        code: str = Form(...),
        admin_user: User = Depends(admin_required),
        background_tasks: BackgroundTasks = BackgroundTasks(),
        session: AsyncSession = Depends(get_session)
):
    """Завантажити архів з додатковими даними"""

    # Валідація
    if not file_service.validate_file_extension(file.filename, ALLOWED_ARCHIVE_EXTENSIONS):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_ARCHIVE_EXTENSIONS)}"
        )

    # Перевірка чи код унікальний
    existing = await session.execute(
        select(Archive).where(Archive.code == code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Archive with this code already exists")

    # Генеруємо ім'я файлу
    filename = file_service.generate_filename(file.filename)
    file_path = ARCHIVE_DIR / filename

    # Зберігаємо файл
    file_info = await file_service.save_uploaded_file(
        file, file_path, MAX_ARCHIVE_SIZE
    )

    # Витягуємо превью в фоні
    background_tasks.add_task(
        file_service.extract_archive_preview,
        file_path
    )

    return {
        "success": True,
        "file_path": f"media/archives/{filename}",
        "file_size": file_info["size"],
        "original_name": file_info["original_name"],
        "code": code
    }


@router.post("/images/batch")
async def upload_images_batch(
        files: List[UploadFile] = File(...),
        archive_id: Optional[int] = Form(None),
        admin_user: User = Depends(admin_required),
        background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Завантажити кілька зображень з обробкою"""

    if len(files) > MAX_IMAGES_PER_PRODUCT:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_IMAGES_PER_PRODUCT} images allowed"
        )

    uploaded_images = []
    errors = []

    for file in files:
        try:
            # Валідація
            if not file_service.validate_file_extension(
                    file.filename, ALLOWED_IMAGE_EXTENSIONS
            ):
                errors.append(f"{file.filename}: Invalid format")
                continue

            # Генеруємо ім'я
            filename = file_service.generate_filename(file.filename)
            temp_path = TEMP_DIR / filename

            # Зберігаємо тимчасово
            await file_service.save_uploaded_file(
                file, temp_path, MAX_IMAGE_SIZE
            )

            # Обробляємо зображення
            processed = await file_service.process_image(temp_path)

            # Переміщуємо оригінал
            final_path = IMAGE_DIR / "original" / filename
            final_path.parent.mkdir(exist_ok=True)
            shutil.move(str(temp_path), str(final_path))

            image_data = {
                "original": f"media/images/original/{filename}",
                "sizes": {
                    k: v.replace("media/", "")
                    for k, v in processed.items()
                },
                "filename": file.filename,
                "archive_id": archive_id
            }

            uploaded_images.append(image_data)

        except Exception as e:
            logger.error(f"Error uploading {file.filename}: {e}")
            errors.append(f"{file.filename}: {str(e)}")

    return {
        "success": len(uploaded_images) > 0,
        "uploaded": uploaded_images,
        "errors": errors,
        "count": len(uploaded_images)
    }


@router.delete("/archive/{filename}")
async def delete_archive_file(
        filename: str,
        admin_user: User = Depends(admin_required)
):
    """Видалити файл архіву"""

    file_path = ARCHIVE_DIR / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        os.remove(file_path)
        return {"success": True, "message": "File deleted"}
    except Exception as e:
        logger.error(f"Error deleting file: {e}")
        raise HTTPException(status_code=500, detail="Error deleting file")


@router.delete("/image/{filename}")
async def delete_image_file(
        filename: str,
        admin_user: User = Depends(admin_required)
):
    """Видалити зображення"""

    # Видаляємо всі розміри
    deleted = []
    for size_name in ["original", "thumbnail", "preview", "full"]:
        file_path = IMAGE_DIR / size_name / filename
        if file_path.exists():
            try:
                os.remove(file_path)
                deleted.append(size_name)
            except Exception as e:
                logger.error(f"Error deleting {size_name}: {e}")

    if not deleted:
        raise HTTPException(status_code=404, detail="Image not found")

    return {
        "success": True,
        "message": f"Deleted from: {', '.join(deleted)}"
    }


@router.get("/archive/{filename}/preview")
async def get_archive_preview(
        filename: str,
        current_user: User = Depends(get_current_user_dependency)
):
    """Отримати превью архіву"""

    file_path = ARCHIVE_DIR / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Archive not found")

    preview = await file_service.extract_archive_preview(file_path)

    return {
        "filename": filename,
        "preview": preview
    }


@router.get("/download/{file_type}/{filename}")
async def download_file(
        file_type: str,
        filename: str,
        current_user: User = Depends(get_current_user_dependency)
):
    """Завантажити файл"""

    if file_type == "archive":
        file_path = ARCHIVE_DIR / filename
    elif file_type == "image":
        file_path = IMAGE_DIR / "original" / filename
    else:
        raise HTTPException(status_code=400, detail="Invalid file type")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type='application/octet-stream'
    )


# Допоміжні функції для очищення
@router.post("/cleanup/temp")
async def cleanup_temp_files(
        admin_user: User = Depends(admin_required)
):
    """Очистити тимчасові файли"""

    deleted_count = 0

    for file_path in TEMP_DIR.glob("*"):
        try:
            if file_path.is_file():
                os.remove(file_path)
                deleted_count += 1
        except Exception as e:
            logger.error(f"Error deleting temp file: {e}")

    return {
        "success": True,
        "deleted_files": deleted_count
    }