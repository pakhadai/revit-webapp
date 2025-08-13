# backend/api/notifications.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from database import get_session
from models.user import User
from models.notification import Notification
from .dependencies import get_current_user_dependency
from typing import List

router = APIRouter()

@router.get("/")
async def get_notifications(
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session)
):
    """Отримати всі повідомлення для користувача та кількість непрочитаних."""
    # Кількість непрочитаних
    unread_count_result = await session.execute(
        select(func.count(Notification.id)).where(Notification.user_id == current_user.id, Notification.is_read == False)
    )
    unread_count = unread_count_result.scalar_one()

    # Список всіх повідомлень
    notifications_result = await session.execute(
        select(Notification).where(Notification.user_id == current_user.id).order_by(Notification.created_at.desc())
    )
    notifications = notifications_result.scalars().all()

    return {"unread_count": unread_count, "notifications": notifications}

@router.post("/{notification_id}/read")
async def mark_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session)
):
    """Позначити повідомлення як прочитане."""
    await session.execute(
        update(Notification)
        .where(Notification.id == notification_id, Notification.user_id == current_user.id)
        .values(is_read=True)
    )
    await session.commit()
    return {"status": "ok"}