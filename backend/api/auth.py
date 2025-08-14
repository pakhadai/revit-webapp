# backend/api/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_session
from models import User, UserRole
from config import settings
from datetime import datetime, timedelta
from typing import Optional, Dict
import hashlib
import hmac
import json
import logging
from fastapi.security import OAuth2PasswordBearer
from urllib.parse import unquote
from jose import JWTError, jwt
import httpx

logger = logging.getLogger(__name__)

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/telegram")
# JWT налаштування
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES

# Список Telegram ID адміністраторів
ADMIN_TELEGRAM_IDS = settings.admin_ids_list


async def get_current_user_dependency(
        token: str = Depends(oauth2_scheme),
        session: AsyncSession = Depends(get_session)
) -> User:
    """Dependency для перевірки токена і отримання користувача"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    result = await session.execute(
        select(User).where(User.id == int(user_id))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Створення JWT токена"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_telegram_data(init_data: str) -> Dict:
    """Перевірка та парсинг даних від Telegram"""
    if not settings.BOT_TOKEN and not (settings.DEV_MODE and init_data == "dev_mode=true"):
        logger.error("BOT_TOKEN is not set in config. Cannot verify Telegram data.")
        raise ValueError("BOT_TOKEN is not configured on the server.")

    # Для режиму розробки
    if settings.DEV_MODE and init_data == "dev_mode=true":
        return {
            "user": {
                "id": 12345,
                "first_name": "Test",
                "last_name": "User",
                "username": "testuser",
                "language_code": "ua",
                "is_premium": False
            },
            "auth_date": str(int(datetime.now().timestamp()))
        }

    try:
        # Парсимо init_data
        parsed_data = {}
        for item in init_data.split('&'):
            if '=' in item:
                key, value = item.split('=', 1)
                parsed_data[key] = unquote(value)

        # Перевіряємо hash
        if 'hash' not in parsed_data:
            raise ValueError("No hash in init_data")

        received_hash = parsed_data.pop('hash')

        # Створюємо data-check-string
        data_check_items = []
        for key in sorted(parsed_data.keys()):
            data_check_items.append(f"{key}={parsed_data[key]}")
        data_check_string = "\n".join(data_check_items)

        # Перевіряємо підпис
        secret_key = hmac.new(
            "WebAppData".encode(),
            settings.BOT_TOKEN.encode(),
            hashlib.sha256
        ).digest()

        calculated_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256
        ).hexdigest()

        if calculated_hash != received_hash:
            raise ValueError("Invalid hash")

        # Перевіряємо час (не старше 1 години)
        auth_date = int(parsed_data.get('auth_date', 0))
        if datetime.now().timestamp() - auth_date > 3600:
            logger.warning("Auth data is too old")
            # В dev режимі ігноруємо старі дані
            if not settings.DEV_MODE:
                raise ValueError("Auth data is too old")

        # Парсимо user дані
        if 'user' in parsed_data:
            parsed_data['user'] = json.loads(parsed_data['user'])

        return parsed_data

    except Exception as e:
        logger.error(f"Failed to verify telegram data: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Telegram data"
        )


async def get_telegram_avatar(telegram_id: int) -> Optional[str]:
    """Отримання URL аватара користувача через Telegram Bot API"""
    if not settings.BOT_TOKEN:
        return None

    try:
        async with httpx.AsyncClient() as client:
            # Отримуємо фото профілю
            response = await client.get(
                f"https://api.telegram.org/bot{settings.BOT_TOKEN}/getUserProfilePhotos",
                params={"user_id": telegram_id, "limit": 1}
            )

            if response.status_code != 200:
                return None

            data = response.json()
            if not data.get("ok") or not data.get("result", {}).get("photos"):
                return None

            # Беремо перше фото, найменший розмір
            photos = data["result"]["photos"]
            if photos and photos[0]:
                file_id = photos[0][0]["file_id"]  # Перше фото, найменший розмір

                # Отримуємо шлях до файлу
                file_response = await client.get(
                    f"https://api.telegram.org/bot{settings.BOT_TOKEN}/getFile",
                    params={"file_id": file_id}
                )

                if file_response.status_code == 200:
                    file_data = file_response.json()
                    if file_data.get("ok") and file_data.get("result", {}).get("file_path"):
                        file_path = file_data["result"]["file_path"]
                        # Повертаємо URL для завантаження
                        return f"https://api.telegram.org/file/bot{settings.BOT_TOKEN}/{file_path}"

    except Exception as e:
        logger.error(f"Failed to get avatar for user {telegram_id}: {e}")

    return None


@router.post("/telegram")
async def telegram_auth(
        request: Dict,
        session: AsyncSession = Depends(get_session)
):
    """Авторизація через Telegram Web App"""

    init_data = request.get("init_data", "")

    if not init_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No init_data provided"
        )

    # Перевіряємо дані від Telegram
    telegram_data = verify_telegram_data(init_data)

    if 'user' not in telegram_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No user data in init_data"
        )

    tg_user = telegram_data['user']
    telegram_id = str(tg_user['id'])

    # Шукаємо користувача в БД
    result = await session.execute(
        select(User).where(User.telegram_id == telegram_id)
    )
    user = result.scalar_one_or_none()

    # Визначаємо роль
    user_role = UserRole.USER
    if telegram_id in ADMIN_TELEGRAM_IDS:
        user_role = UserRole.ADMIN

    if not user:
        # Створюємо нового користувача
        logger.info(f"Creating new user: {telegram_id}")

        # Отримуємо аватар
        avatar_url = await get_telegram_avatar(int(telegram_id))

        # Генеруємо реферальний код
        referral_code = hashlib.md5(f"{telegram_id}_{datetime.now()}".encode()).hexdigest()[:8]

        user = User(
            telegram_id=telegram_id,
            username=tg_user.get('username'),
            first_name=tg_user.get('first_name'),
            last_name=tg_user.get('last_name'),
            language_code=tg_user.get('language_code', 'en')[:2],  # Беремо тільки мову (ua, en, ru)
            is_premium=tg_user.get('is_premium', False),
            avatar_url=avatar_url,
            role=user_role,
            referral_code=referral_code,
            bonus_balance=settings.WELCOME_BONUS_AMOUNT,  # Бонус за реєстрацію
            created_at=datetime.now(),
            last_active=datetime.now()
        )

        session.add(user)
        await session.commit()
        await session.refresh(user)

        is_new_user = True
    else:
        # Оновлюємо існуючого користувача
        logger.info(f"Updating existing user: {telegram_id}")

        # Оновлюємо аватар, якщо немає
        if not user.avatar_url:
            user.avatar_url = await get_telegram_avatar(int(telegram_id))

        # Оновлюємо дані
        user.username = tg_user.get('username') or user.username
        user.first_name = tg_user.get('first_name') or user.first_name
        user.last_name = tg_user.get('last_name') or user.last_name
        user.language_code = tg_user.get('language_code', user.language_code)[:2]
        user.is_premium = tg_user.get('is_premium', False)
        user.last_active = datetime.now()

        # Оновлюємо роль, якщо став адміном
        if telegram_id in ADMIN_TELEGRAM_IDS and user.role == UserRole.USER:
            user.role = UserRole.ADMIN

        await session.commit()
        await session.refresh(user)

        is_new_user = False

    # Створюємо токен
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "telegram_id": user.telegram_id,
            "role": user.role.value
        }
    )

    # Формуємо відповідь
    return {
        "success": True,
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
            "avatar_url": user.avatar_url,
            "role": user.role.value,
            "is_admin": user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN],
            "is_premium": user.is_premium,
            "has_subscription": user.has_subscription,
            "bonus_balance": user.bonus_balance,
            "vip_level": user.vip_level,
            "referral_code": user.referral_code,
            "created_at": user.created_at.isoformat() if user.created_at else None
        }
    }


@router.get("/me")
async def get_current_user(
        current_user: User = Depends(get_current_user_dependency),
):
    """Отримання поточного користувача"""
    return {
        "id": current_user.id,
        "telegram_id": current_user.telegram_id,
        "username": current_user.username,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "language_code": current_user.language_code,
        "avatar_url": current_user.avatar_url,
        "role": current_user.role.value,
        "is_admin": current_user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN],
        "is_premium": current_user.is_premium,
        "has_subscription": current_user.has_subscription,
        "bonus_balance": current_user.bonus_balance,
        "vip_level": current_user.vip_level
    }
