# backend/api/auth_fallback.py
# Створіть новий файл з цим кодом

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
import hashlib
import logging
from typing import Dict

from database import get_session
from models import User, UserRole, BonusTransaction, BonusTransactionType
from config import settings
from jose import jwt

logger = logging.getLogger(__name__)

router = APIRouter()

# JWT налаштування
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES


def create_access_token(data: dict, expires_delta: timedelta = None):
    """Створення JWT токена"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


@router.post("/telegram-fallback")
async def telegram_auth_fallback(
        request: Dict,
        session: AsyncSession = Depends(get_session)
):
    """Резервна авторизація для розробки або коли Telegram недоступний"""

    logger.info("=== FALLBACK AUTH REQUEST ===")

    try:
        # В режимі розробки створюємо тестового користувача
        if settings.DEV_MODE:
            # Генеруємо унікальний ID на основі user agent або часу
            user_agent = request.get("user_agent", "unknown")
            timestamp = request.get("timestamp", datetime.now().timestamp())

            # Створюємо хеш для унікального ID
            unique_string = f"{user_agent}_{timestamp}_{settings.SECRET_KEY}"
            telegram_id = str(abs(hash(unique_string)) % 10000000)

            logger.info(f"Fallback auth for dev user: {telegram_id}")

            # Перевіряємо чи є користувач
            result = await session.execute(
                select(User).where(User.telegram_id == telegram_id)
            )
            user = result.scalar_one_or_none()

            is_new_user = False

            if not user:
                # Створюємо нового користувача
                is_new_user = True
                referral_code = hashlib.md5(f"{telegram_id}_{datetime.now()}".encode()).hexdigest()[:8]

                user = User(
                    telegram_id=telegram_id,
                    username=f"dev_user_{telegram_id[:6]}",
                    first_name="Test",
                    last_name="User",
                    language_code="ua",
                    is_premium=False,
                    is_onboarded=False,  # Для нових користувачів - false
                    bonus_balance=100,  # Початковий бонус
                    referral_code=referral_code.upper(),
                    role=UserRole.USER,
                    created_at=datetime.now()
                )

                session.add(user)

                # Додаємо початковий бонус
                welcome_bonus = BonusTransaction(
                    user_id=user.id,
                    amount=100,
                    transaction_type=BonusTransactionType.WELCOME_BONUS,
                    description="Вітальний бонус",
                    created_at=datetime.now()
                )
                session.add(welcome_bonus)

                await session.commit()
                await session.refresh(user)

                logger.info(f"Created new dev user: {user.id}")

            # Створюємо токен
            access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            access_token = create_access_token(
                data={"sub": str(user.id)},
                expires_delta=access_token_expires
            )

            return {
                "access_token": access_token,
                "token_type": "bearer",
                "is_new_user": is_new_user,
                "user": {
                    "id": user.id,
                    "telegram_id": user.telegram_id,
                    "username": user.username,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "language_code": user.language_code,
                    "is_premium": user.is_premium,
                    "is_onboarded": user.is_onboarded,
                    "bonus_balance": user.bonus_balance,
                    "referral_code": user.referral_code,
                    "has_subscription": user.has_subscription,
                    "role": user.role.value,
                    "created_at": user.created_at.isoformat() if user.created_at else None
                }
            }

        else:
            # В продакшн режимі не дозволяємо fallback
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Fallback auth is only available in development mode"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fallback auth error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authentication failed: {str(e)}"
        )