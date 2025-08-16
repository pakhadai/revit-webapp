from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_session
from models import User, UserRole
from config import settings
from datetime import datetime
import hashlib
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/telegram-fallback")
async def telegram_auth_fallback(
        request: dict,
        session: AsyncSession = Depends(get_session)
):
    """Резервна авторизація якщо Telegram не передає дані"""

    # Отримуємо хоч якісь дані
    user_agent = request.get("user_agent", "")
    timestamp = datetime.now().timestamp()

    # Генеруємо унікальний ID на основі user agent та часу
    unique_string = f"{user_agent}_{timestamp}"
    telegram_id = str(abs(hash(unique_string)) % 10000000)

    logger.warning(f"Using fallback auth for ID: {telegram_id}")

    # Шукаємо або створюємо користувача
    result = await session.execute(
        select(User).where(User.telegram_id == telegram_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            telegram_id=telegram_id,
            username=f"user_{telegram_id}",
            first_name="Guest",
            last_name="User",
            language_code='ua',
            role=UserRole.USER,
            referral_code=hashlib.md5(telegram_id.encode()).hexdigest()[:8],
            bonus_balance=100,  # Даємо бонуси для тесту
            created_at=datetime.now(),
            last_active=datetime.now()
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

    # Створюємо токен
    from api.auth import create_access_token
    access_token = create_access_token(
        data={"sub": str(user.id), "telegram_id": telegram_id}
    )

    return {
        "success": True,
        "access_token": access_token,
        "user": {
            "id": user.id,
            "telegram_id": telegram_id,
            "username": user.username,
            "first_name": user.first_name,
            "language_code": user.language_code,
            "bonuses": user.bonus_balance,
            "role": user.role.value,
            "is_admin": user.role == UserRole.ADMIN
        }
    }
