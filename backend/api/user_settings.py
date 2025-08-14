# backend/api/user_settings.py
"""
API для налаштувань профілю користувача
Створіть цей новий файл в папці backend/api/
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import datetime
import logging

from database import get_session
from models.user import User
from api.dependencies import get_current_user_dependency

router = APIRouter()
logger = logging.getLogger(__name__)


# Pydantic моделі для валідації
class UserSettingsUpdate(BaseModel):
    """Модель для оновлення налаштувань"""
    language_code: Optional[str] = Field(None, pattern="^(ua|en|ru|de|ar)$") # ВИПРАВЛЕНО ТУТ

    # Налаштування сповіщень
    notify_new_archives: Optional[bool] = None
    notify_promotions: Optional[bool] = None
    notify_bonuses: Optional[bool] = None
    notify_order_status: Optional[bool] = None
    notify_subscription_expiry: Optional[bool] = None

    # Налаштування інтерфейсу
    theme: Optional[str] = Field(None, pattern="^(light|dark|auto)$") # ВИПРАВЛЕНО ТУТ
    compact_view: Optional[bool] = None
    show_prices_with_vat: Optional[bool] = None

    # Налаштування конфіденційності
    profile_visibility: Optional[str] = Field(None, pattern="^(public|friends|private)$") # ВИПРАВЛЕНО ТУТ
    show_purchase_history: Optional[bool] = None
    allow_friend_requests: Optional[bool] = None

    # Персональна інформація (опціонально)
    display_name: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = Field(None, max_length=500)
    country: Optional[str] = Field(None, max_length=2)  # ISO код країни
    timezone: Optional[str] = Field(None, max_length=50)


class UserSettingsResponse(BaseModel):
    """Модель відповіді з налаштуваннями"""
    user_id: int
    language_code: str

    # Налаштування сповіщень
    notify_new_archives: bool
    notify_promotions: bool
    notify_bonuses: bool
    notify_order_status: bool
    notify_subscription_expiry: bool

    # Налаштування інтерфейсу
    theme: str
    compact_view: bool
    show_prices_with_vat: bool

    # Налаштування конфіденційності
    profile_visibility: str
    show_purchase_history: bool
    allow_friend_requests: bool

    # Персональна інформація
    display_name: Optional[str]
    bio: Optional[str]
    country: Optional[str]
    timezone: Optional[str]

    # Додаткова інформація
    email_verified: bool
    phone_verified: bool
    two_factor_enabled: bool

    class Config:
        from_attributes = True


# Оновлюємо модель User (додайте ці поля в backend/models/user.py):
"""
# Додайте ці поля в клас User:

# Налаштування сповіщень
notify_new_archives = Column(Boolean, default=True)
notify_promotions = Column(Boolean, default=True)
notify_bonuses = Column(Boolean, default=True)
notify_order_status = Column(Boolean, default=True)
notify_subscription_expiry = Column(Boolean, default=True)

# Налаштування інтерфейсу
theme = Column(String(20), default='auto')
compact_view = Column(Boolean, default=False)
show_prices_with_vat = Column(Boolean, default=False)

# Налаштування конфіденційності
profile_visibility = Column(String(20), default='public')
show_purchase_history = Column(Boolean, default=True)
allow_friend_requests = Column(Boolean, default=True)

# Персональна інформація
display_name = Column(String(100), nullable=True)
bio = Column(Text, nullable=True)
country = Column(String(2), nullable=True)
timezone = Column(String(50), default='Europe/Kiev')

# Безпека
email_verified = Column(Boolean, default=False)
phone_verified = Column(Boolean, default=False)
two_factor_enabled = Column(Boolean, default=False)
last_settings_update = Column(DateTime, nullable=True)
"""


@router.get("/settings", response_model=UserSettingsResponse)
async def get_user_settings(
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Отримати поточні налаштування користувача"""

    # Оновлюємо сесію для отримання свіжих даних
    await session.refresh(current_user)

    return UserSettingsResponse(
        user_id=current_user.id,
        language_code=current_user.language_code or 'ua',

        # Налаштування сповіщень (з дефолтними значеннями)
        notify_new_archives=getattr(current_user, 'notify_new_archives', True),
        notify_promotions=getattr(current_user, 'notify_promotions', True),
        notify_bonuses=getattr(current_user, 'notify_bonuses', True),
        notify_order_status=getattr(current_user, 'notify_order_status', True),
        notify_subscription_expiry=getattr(current_user, 'notify_subscription_expiry', True),

        # Налаштування інтерфейсу
        theme=getattr(current_user, 'theme', 'auto'),
        compact_view=getattr(current_user, 'compact_view', False),
        show_prices_with_vat=getattr(current_user, 'show_prices_with_vat', False),

        # Налаштування конфіденційності
        profile_visibility=getattr(current_user, 'profile_visibility', 'public'),
        show_purchase_history=getattr(current_user, 'show_purchase_history', True),
        allow_friend_requests=getattr(current_user, 'allow_friend_requests', True),

        # Персональна інформація
        display_name=getattr(current_user, 'display_name', None),
        bio=getattr(current_user, 'bio', None),
        country=getattr(current_user, 'country', None),
        timezone=getattr(current_user, 'timezone', 'Europe/Kiev'),

        # Безпека
        email_verified=getattr(current_user, 'email_verified', False),
        phone_verified=getattr(current_user, 'phone_verified', False),
        two_factor_enabled=getattr(current_user, 'two_factor_enabled', False)
    )


@router.put("/settings")
async def update_user_settings(
        settings: UserSettingsUpdate,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Оновити налаштування користувача"""

    try:
        # Отримуємо словник з не-None значеннями
        update_data = settings.dict(exclude_unset=True)

        if not update_data:
            raise HTTPException(status_code=400, detail="No settings to update")

        # Оновлюємо поля користувача
        for field, value in update_data.items():
            if hasattr(current_user, field):
                setattr(current_user, field, value)

        # Оновлюємо час останньої зміни налаштувань
        if hasattr(current_user, 'last_settings_update'):
            current_user.last_settings_update = datetime.utcnow()

        await session.commit()
        await session.refresh(current_user)

        logger.info(f"User {current_user.id} updated settings: {list(update_data.keys())}")

        return {
            "success": True,
            "message": "Settings updated successfully",
            "updated_fields": list(update_data.keys())
        }

    except Exception as e:
        await session.rollback()
        logger.error(f"Error updating settings for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update settings")


@router.post("/settings/reset")
async def reset_user_settings(
        category: str,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Скинути налаштування до значень за замовчуванням"""

    default_settings = {
        "notifications": {
            "notify_new_archives": True,
            "notify_promotions": True,
            "notify_bonuses": True,
            "notify_order_status": True,
            "notify_subscription_expiry": True
        },
        "interface": {
            "theme": "auto",
            "compact_view": False,
            "show_prices_with_vat": False
        },
        "privacy": {
            "profile_visibility": "public",
            "show_purchase_history": True,
            "allow_friend_requests": True
        }
    }

    if category not in default_settings:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Available: {list(default_settings.keys())}"
        )

    try:
        # Скидаємо налаштування вибраної категорії
        for field, value in default_settings[category].items():
            if hasattr(current_user, field):
                setattr(current_user, field, value)

        await session.commit()

        return {
            "success": True,
            "message": f"{category} settings reset to defaults",
            "reset_fields": list(default_settings[category].keys())
        }

    except Exception as e:
        await session.rollback()
        logger.error(f"Error resetting settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset settings")


@router.get("/settings/export")
async def export_user_settings(
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Експортувати всі налаштування користувача"""

    await session.refresh(current_user)

    settings_export = {
        "user_info": {
            "user_id": current_user.id,
            "username": current_user.username,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None
        },
        "language": current_user.language_code,
        "notifications": {
            "new_archives": getattr(current_user, 'notify_new_archives', True),
            "promotions": getattr(current_user, 'notify_promotions', True),
            "bonuses": getattr(current_user, 'notify_bonuses', True),
            "order_status": getattr(current_user, 'notify_order_status', True),
            "subscription_expiry": getattr(current_user, 'notify_subscription_expiry', True)
        },
        "interface": {
            "theme": getattr(current_user, 'theme', 'auto'),
            "compact_view": getattr(current_user, 'compact_view', False),
            "show_prices_with_vat": getattr(current_user, 'show_prices_with_vat', False)
        },
        "privacy": {
            "profile_visibility": getattr(current_user, 'profile_visibility', 'public'),
            "show_purchase_history": getattr(current_user, 'show_purchase_history', True),
            "allow_friend_requests": getattr(current_user, 'allow_friend_requests', True)
        },
        "personal": {
            "display_name": getattr(current_user, 'display_name', None),
            "bio": getattr(current_user, 'bio', None),
            "country": getattr(current_user, 'country', None),
            "timezone": getattr(current_user, 'timezone', 'Europe/Kiev')
        },
        "security": {
            "email_verified": getattr(current_user, 'email_verified', False),
            "phone_verified": getattr(current_user, 'phone_verified', False),
            "two_factor_enabled": getattr(current_user, 'two_factor_enabled', False)
        },
        "export_date": datetime.utcnow().isoformat()
    }

    return settings_export


@router.post("/settings/import")
async def import_user_settings(
        settings_data: Dict,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Імпортувати налаштування користувача"""

    try:
        imported_fields = []

        # Мовні налаштування
        if "language" in settings_data:
            current_user.language_code = settings_data["language"]
            imported_fields.append("language")

        # Налаштування сповіщень
        if "notifications" in settings_data:
            for key, value in settings_data["notifications"].items():
                field_name = f"notify_{key}"
                if hasattr(current_user, field_name):
                    setattr(current_user, field_name, value)
                    imported_fields.append(field_name)

        # Налаштування інтерфейсу
        if "interface" in settings_data:
            for key, value in settings_data["interface"].items():
                if hasattr(current_user, key):
                    setattr(current_user, key, value)
                    imported_fields.append(key)

        # Налаштування конфіденційності
        if "privacy" in settings_data:
            for key, value in settings_data["privacy"].items():
                if hasattr(current_user, key):
                    setattr(current_user, key, value)
                    imported_fields.append(key)

        # Персональні дані (тільки якщо дозволено)
        if "personal" in settings_data:
            for key, value in settings_data["personal"].items():
                if hasattr(current_user, key) and key != "user_id":
                    setattr(current_user, key, value)
                    imported_fields.append(key)

        await session.commit()

        return {
            "success": True,
            "message": "Settings imported successfully",
            "imported_fields": imported_fields
        }

    except Exception as e:
        await session.rollback()
        logger.error(f"Error importing settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to import settings")