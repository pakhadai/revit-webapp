# backend/api/auth.py - ПОВНІСТЮ РОБОЧА ВЕРСІЯ
from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_session
from models.user import User
from config import settings
import hashlib
import hmac
import json
from urllib.parse import unquote
from datetime import datetime, timedelta
from jose import jwt, JWTError
from typing import Optional

router = APIRouter()


# --- Функція для створення JWT токенів ---
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


# --- ВИПРАВЛЕНА залежність для авторизації ---
async def get_current_user_dependency(
        authorization: Optional[str] = Header(None),
        session: AsyncSession = Depends(get_session)
):
    """Залежність для отримання поточного користувача з токена в заголовку Authorization"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    try:
        # Отримуємо токен з заголовка "Bearer TOKEN"
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header format")

        token = authorization.replace("Bearer ", "")

        # Декодуємо токен
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            user_id_raw = payload.get("sub")

            # ВИПРАВЛЕННЯ: Перетворюємо у число, якщо треба
            if isinstance(user_id_raw, str):
                user_id = int(user_id_raw)
            elif isinstance(user_id_raw, int):
                user_id = user_id_raw
            else:
                raise HTTPException(status_code=401, detail="Invalid user ID in token")

        except (JWTError, ValueError, TypeError) as e:
            raise HTTPException(status_code=401, detail=f"Token validation failed: {str(e)}")

        # Отримуємо користувача з бази даних
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if user is None:
            raise HTTPException(status_code=401, detail="User not found")

        return user

    except HTTPException:
        # Перекидаємо HTTPException як є
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


def verify_telegram_data(init_data: str) -> dict:
    """
    Перевіряє дані ініціалізації Telegram WebApp.
    У режимі DEV_MODE повертає тестові дані.
    """
    if settings.DEV_MODE:
        return {
            "user": {
                "id": 12345, "first_name": "Test", "last_name": "User",
                "username": "testuser", "language_code": "ua"
            }
        }

    try:
        data_dict = sorted([pair.split('=', 1) for pair in init_data.split('&')], key=lambda x: x[0])
        data_check_string = "\n".join([f"{key}={value}" for key, value in data_dict if key != 'hash'])

        secret_key = hmac.new("WebAppData".encode(), settings.BOT_TOKEN.encode(), hashlib.sha256).digest()
        h = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256)

        received_hash = dict(data_dict).get('hash')
        if not received_hash or h.hexdigest() != received_hash:
            raise HTTPException(status_code=401, detail="Invalid hash")

        user_data_str = dict(data_dict).get('user', '{}')
        return {"user": json.loads(unquote(user_data_str))}

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid init data: {e}")


@router.post("/telegram")
async def telegram_auth(data: dict, session: AsyncSession = Depends(get_session)):
    try:
        verified_data = verify_telegram_data(data.get('initData', ''))
        tg_user = verified_data['user']

        result = await session.execute(select(User).where(User.user_id == tg_user['id']))
        user = result.scalar_one_or_none()

        if not user:
            user = User(
                user_id=tg_user['id'],
                username=tg_user.get('username'),
                full_name=f"{tg_user.get('first_name', '')} {tg_user.get('last_name', '')}".strip(),
                language_code=tg_user.get('language_code', 'en')
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)

        # ВИПРАВЛЕННЯ: Створюємо токен з рядковим ID
        access_token = create_access_token(data={"sub": str(user.id)})

        return {
            "success": True,
            "token": access_token,
            "user": {
                "id": user.id, "userId": user.user_id, "username": user.username,
                "fullName": user.full_name, "language": user.language_code,
                "isAdmin": user.is_admin, "role": user.role, "bonuses": user.bonuses
            }
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))