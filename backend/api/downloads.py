# backend/api/downloads.py
from fastapi import APIRouter, Depends, HTTPException, Response, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from database import get_session
from models.user import User
from models.archive import Archive, ArchivePurchase
from models.subscription import SubscriptionArchive
from services.file_service import file_service
from config import settings
from .dependencies import get_current_user_dependency
import aiofiles
from pathlib import Path
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/request/{archive_id}")
async def request_download(
        archive_id: int,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Запит на завантаження архіву"""

    # Отримуємо архів
    result = await session.execute(
        select(Archive).where(Archive.id == archive_id)
    )
    archive = result.scalar_one_or_none()

    if not archive:
        raise HTTPException(status_code=404, detail="Archive not found")

    # Перевіряємо доступ
    has_access = await check_user_access(current_user.id, archive_id, session)

    if not has_access and archive.archive_type != "free":
        raise HTTPException(status_code=403, detail="Access denied. Please purchase or subscribe.")

    # Отримуємо шлях до файлу
    file_path = await file_service.get_archive_file_path(archive.code, archive.archive_type)

    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Archive file not found")

    # Отримуємо інформацію про файл
    file_info = await file_service.get_file_info(file_path)

    # Генеруємо токен для завантаження
    download_token = file_service.generate_download_token(
        user_id=current_user.id,
        archive_id=archive_id,
        expires_minutes=60
    )

    # Оновлюємо статистику
    archive.view_count += 1
    await session.commit()

    return {
        "success": True,
        "archive": {
            "id": archive.id,
            "code": archive.code,
            "title": archive.title,
            "type": archive.archive_type
        },
        "file": file_info,
        "download_token": download_token,
        "download_url": f"/api/downloads/file/{download_token}",
        "expires_in": 3600  # секунд
    }


@router.get("/file/{token}")
async def download_file(
        token: str,
        background_tasks: BackgroundTasks,
        session: AsyncSession = Depends(get_session)
):
    """Завантажити файл за токеном"""

    # Перевіряємо токен
    token_data = file_service.validate_download_token(token)

    if not token_data:
        raise HTTPException(status_code=401, detail="Invalid or expired download token")

    # Отримуємо архів
    result = await session.execute(
        select(Archive).where(Archive.id == token_data["archive_id"])
    )
    archive = result.scalar_one_or_none()

    if not archive:
        raise HTTPException(status_code=404, detail="Archive not found")

    # Отримуємо файл
    file_path = await file_service.get_archive_file_path(archive.code, archive.archive_type)

    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # Оновлюємо лічильник завантажень
    file_service.downloads_cache[token]["downloads"] += 1

    # Оновлюємо статистику архіву
    archive.purchase_count += 1
    await session.commit()

    # Логуємо завантаження
    logger.info(f"User {token_data['user_id']} downloading archive {archive.code}")

    # Чистимо кеш в фоні
    background_tasks.add_task(file_service.cleanup_expired_tokens)

    # Визначаємо ім'я файлу для завантаження
    download_filename = f"{archive.code}_{archive.title.get('en', 'archive').replace(' ', '_')}{file_path.suffix}"

    # Повертаємо файл
    return FileResponse(
        path=file_path,
        filename=download_filename,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename={download_filename}",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


@router.get("/preview/{archive_id}")
async def get_archive_preview(
        archive_id: int,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Отримати превью архіву (список файлів)"""

    # Отримуємо архів
    result = await session.execute(
        select(Archive).where(Archive.id == archive_id)
    )
    archive = result.scalar_one_or_none()

    if not archive:
        raise HTTPException(status_code=404, detail="Archive not found")

    # Перевіряємо чи є превью
    preview_path = settings.MEDIA_DIR / "previews" / f"preview_{archive_id}.txt"

    if not preview_path.exists():
        # Створюємо превью
        file_path = await file_service.get_archive_file_path(archive.code, archive.archive_type)

        if file_path:
            preview_path = await file_service.create_preview(archive_id, file_path)

    if not preview_path or not preview_path.exists():
        return {
            "success": False,
            "message": "Preview not available"
        }

    # Читаємо превью
    async with aiofiles.open(preview_path, 'r', encoding='utf-8') as f:
        content = await f.read()

    return {
        "success": True,
        "archive": {
            "id": archive.id,
            "code": archive.code,
            "title": archive.title
        },
        "preview": content
    }


@router.get("/user-archives")
async def get_user_archives(
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Отримати список архівів доступних користувачу"""

    user_archives = []

    # 1. Безкоштовні архіви
    free_result = await session.execute(
        select(Archive).where(Archive.archive_type == "free")
    )
    free_archives = free_result.scalars().all()

    for archive in free_archives:
        user_archives.append({
            "archive": {
                "id": archive.id,
                "code": archive.code,
                "title": archive.title,
                "type": "free"
            },
            "access_type": "free",
            "can_download": True
        })

    # 2. Куплені архіви
    purchased_result = await session.execute(
        select(ArchivePurchase, Archive)
        .join(Archive, ArchivePurchase.archive_id == Archive.id)
        .where(ArchivePurchase.user_id == current_user.id)
    )

    for purchase, archive in purchased_result.all():
        user_archives.append({
            "archive": {
                "id": archive.id,
                "code": archive.code,
                "title": archive.title,
                "type": archive.archive_type
            },
            "access_type": "purchased",
            "purchased_at": purchase.purchased_at.isoformat() if purchase.purchased_at else None,
            "can_download": True
        })

    # 3. Архіви з підписки
    subscription_result = await session.execute(
        select(SubscriptionArchive, Archive)
        .join(Archive, SubscriptionArchive.archive_id == Archive.id)
        .where(SubscriptionArchive.user_id == current_user.id)
    )

    for sub_archive, archive in subscription_result.all():
        user_archives.append({
            "archive": {
                "id": archive.id,
                "code": archive.code,
                "title": archive.title,
                "type": archive.archive_type
            },
            "access_type": "subscription",
            "unlocked_at": sub_archive.unlocked_at.isoformat() if sub_archive.unlocked_at else None,
            "can_download": True
        })

    return {
        "total": len(user_archives),
        "archives": user_archives
    }


async def check_user_access(user_id: int, archive_id: int, session: AsyncSession) -> bool:
    """Перевірити чи має користувач доступ до архіву"""

    # Перевіряємо покупку
    purchase_result = await session.execute(
        select(ArchivePurchase).where(
            ArchivePurchase.user_id == user_id,
            ArchivePurchase.archive_id == archive_id
        )
    )
    if purchase_result.scalar_one_or_none():
        return True

    # Перевіряємо підписку
    subscription_result = await session.execute(
        select(SubscriptionArchive).where(
            SubscriptionArchive.user_id == user_id,
            SubscriptionArchive.archive_id == archive_id
        )
    )
    if subscription_result.scalar_one_or_none():
        return True

    return False


@router.get("/statistics")
async def get_download_statistics(
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Отримати статистику завантажень користувача"""

    # Кількість покупок
    purchases_count = await session.execute(
        select(func.count(ArchivePurchase.id))
        .where(ArchivePurchase.user_id == current_user.id)
    )

    # Кількість архівів з підписки
    subscription_count = await session.execute(
        select(func.count(SubscriptionArchive.id))
        .where(SubscriptionArchive.user_id == current_user.id)
    )

    return {
        "purchased_archives": purchases_count.scalar_one(),
        "subscription_archives": subscription_count.scalar_one(),
        "total_available": purchases_count.scalar_one() + subscription_count.scalar_one()
    }
