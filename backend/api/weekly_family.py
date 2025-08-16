# backend/api/weekly_family.py
"""
API для управління Сімейством тижня
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from datetime import datetime, timedelta, timezone
import pytz
from typing import Optional

from models import Archive, WeeklySpecial
from database import get_session
from auth_dependency import get_current_user
from schemas import UserRead

router = APIRouter(prefix="/api", tags=["Weekly Family"])

# Київський часовий пояс
KYIV_TZ = pytz.timezone('Europe/Kiev')


@router.get("/weekly-family")
async def get_weekly_family(
        session: AsyncSession = Depends(get_session),
        current_user: Optional[UserRead] = Depends(get_current_user)
):
    """Отримати поточне Сімейство тижня"""

    try:
        # Шукаємо активне Сімейство тижня
        now = datetime.now(KYIV_TZ)

        # Спочатку перевіряємо чи є записи в таблиці WeeklySpecial
        query = select(WeeklySpecial).where(
            and_(
                WeeklySpecial.is_active == True,
                WeeklySpecial.start_date <= now,
                WeeklySpecial.end_date >= now
            )
        )

        result = await session.execute(query)
        weekly_special = result.scalar_one_or_none()

        if weekly_special:
            # Отримуємо архів
            archive_query = select(Archive).where(Archive.id == weekly_special.archive_id)
            archive_result = await session.execute(archive_query)
            archive = archive_result.scalar_one_or_none()

            if archive:
                return {
                    "id": archive.id,
                    "title": archive.title,
                    "description": archive.description,
                    "original_price": archive.price,
                    "discount_price": weekly_special.discount_price,
                    "discount_percent": weekly_special.discount_percent,
                    "image_url": archive.image_url,
                    "ends_at": weekly_special.end_date.isoformat(),
                    "bonus_multiplier": weekly_special.bonus_multiplier,
                    "is_featured": True
                }

        # Якщо немає активного спеціального - вибираємо автоматично
        # Беремо найпопулярніший архів за останній тиждень
        popular_query = """
            SELECT a.*, COUNT(p.id) as purchase_count
            FROM archives a
            LEFT JOIN purchases p ON a.id = p.archive_id 
                AND p.created_at >= :week_ago
            WHERE a.is_active = true
            GROUP BY a.id
            ORDER BY purchase_count DESC, a.price DESC
            LIMIT 1
        """

        week_ago = now - timedelta(days=7)
        result = await session.execute(
            popular_query,
            {"week_ago": week_ago}
        )
        archive = result.first()

        if not archive:
            # Якщо немає покупок - беремо найдорожчий архів
            fallback_query = select(Archive).where(
                Archive.is_active == True
            ).order_by(Archive.price.desc())

            result = await session.execute(fallback_query)
            archive = result.scalar_one_or_none()

        if archive:
            # Генеруємо автоматичну знижку 30-50%
            import random
            discount_percent = random.randint(30, 50)
            discount_price = round(archive.price * (1 - discount_percent / 100), 2)

            # Кінець тижня - наступна неділя 23:59 Київського часу
            days_until_sunday = (6 - now.weekday()) % 7
            if days_until_sunday == 0:
                days_until_sunday = 7

            end_date = now.replace(hour=23, minute=59, second=59) + timedelta(days=days_until_sunday)

            return {
                "id": archive.id,
                "title": archive.title,
                "description": archive.description or f"Ексклюзивна пропозиція тижня! Економія {discount_percent}%",
                "original_price": float(archive.price),
                "discount_price": discount_price,
                "discount_percent": discount_percent,
                "image_url": archive.image_url or "/images/placeholder.jpg",
                "ends_at": end_date.isoformat(),
                "bonus_multiplier": 1.5,
                "is_featured": False  # Не з таблиці спеціальних
            }

        # Якщо взагалі немає архівів - повертаємо заглушку
        return {
            "id": 0,
            "title": "Premium Revit Family Pack",
            "description": "Незабаром! Слідкуйте за оновленнями.",
            "original_price": 99.99,
            "discount_price": 49.99,
            "discount_percent": 50,
            "image_url": "/images/coming-soon.jpg",
            "ends_at": (now + timedelta(days=7)).isoformat(),
            "bonus_multiplier": 2.0,
            "is_featured": False
        }

    except Exception as e:
        print(f"Error getting weekly family: {e}")
        # Повертаємо дефолтні дані при помилці
        return {
            "id": 1,
            "title": "Weekly Special Family",
            "description": "Special offer of the week",
            "original_price": 99.99,
            "discount_price": 49.99,
            "discount_percent": 50,
            "image_url": "/images/placeholder.jpg",
            "ends_at": (datetime.now(KYIV_TZ) + timedelta(days=7)).isoformat(),
            "bonus_multiplier": 1.5,
            "is_featured": False
        }


@router.post("/weekly-family/{archive_id}/set")
async def set_weekly_family(
        archive_id: int,
        discount_percent: int,
        session: AsyncSession = Depends(get_session),
        current_user: UserRead = Depends(get_current_user)
):
    """Встановити архів як Сімейство тижня (тільки для адмінів)"""

    # Перевірка прав адміна
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can set weekly family"
        )

    # Перевіряємо що архів існує
    archive_query = select(Archive).where(Archive.id == archive_id)
    result = await session.execute(archive_query)
    archive = result.scalar_one_or_none()

    if not archive:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archive not found"
        )

    # Деактивуємо попередні спеціальні пропозиції
    update_query = """
        UPDATE weekly_specials 
        SET is_active = false 
        WHERE is_active = true
    """
    await session.execute(update_query)

    # Створюємо нову спеціальну пропозицію
    now = datetime.now(KYIV_TZ)
    days_until_sunday = (6 - now.weekday()) % 7
    if days_until_sunday == 0:
        days_until_sunday = 7

    end_date = now.replace(hour=23, minute=59, second=59) + timedelta(days=days_until_sunday)
    discount_price = round(archive.price * (1 - discount_percent / 100), 2)

    weekly_special = WeeklySpecial(
        archive_id=archive_id,
        discount_percent=discount_percent,
        discount_price=discount_price,
        start_date=now,
        end_date=end_date,
        is_active=True,
        bonus_multiplier=1.5 if discount_percent >= 40 else 1.3
    )

    session.add(weekly_special)
    await session.commit()

    return {
        "success": True,
        "message": f"Archive '{archive.title}' set as weekly family with {discount_percent}% discount",
        "ends_at": end_date.isoformat()
    }


@router.delete("/weekly-family/cancel")
async def cancel_weekly_family(
        session: AsyncSession = Depends(get_session),
        current_user: UserRead = Depends(get_current_user)
):
    """Скасувати поточне Сімейство тижня (тільки для адмінів)"""

    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can cancel weekly family"
        )

    # Деактивуємо всі активні спеціальні пропозиції
    update_query = """
        UPDATE weekly_specials 
        SET is_active = false 
        WHERE is_active = true
    """
    result = await session.execute(update_query)
    await session.commit()

    return {
        "success": True,
        "message": "Weekly family cancelled"
    }


@router.get("/weekly-family/history")
async def get_weekly_family_history(
        limit: int = 10,
        session: AsyncSession = Depends(get_session),
        current_user: UserRead = Depends(get_current_user)
):
    """Історія Сімейств тижня (тільки для адмінів)"""

    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view history"
        )

    query = """
        SELECT 
            ws.*,
            a.title as archive_title,
            a.price as original_price,
            COUNT(p.id) as purchases_count,
            SUM(p.total_price) as total_revenue
        FROM weekly_specials ws
        JOIN archives a ON ws.archive_id = a.id
        LEFT JOIN purchases p ON p.archive_id = ws.archive_id 
            AND p.created_at BETWEEN ws.start_date AND ws.end_date
        GROUP BY ws.id, a.id
        ORDER BY ws.start_date DESC
        LIMIT :limit
    """

    result = await session.execute(query, {"limit": limit})
    history = result.fetchall()

    return {
        "history": [
            {
                "id": row.id,
                "archive_title": row.archive_title,
                "original_price": float(row.original_price),
                "discount_price": float(row.discount_price),
                "discount_percent": row.discount_percent,
                "start_date": row.start_date.isoformat(),
                "end_date": row.end_date.isoformat(),
                "purchases_count": row.purchases_count or 0,
                "total_revenue": float(row.total_revenue or 0),
                "is_active": row.is_active
            }
            for row in history
        ]
    }