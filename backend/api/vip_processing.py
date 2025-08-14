# backend/api/vip_processing.py
"""
Модуль для обробки VIP статусів користувачів
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.user import User
from models.bonus import VipLevel
from config import settings
import logging

logger = logging.getLogger(__name__)


async def update_vip_status_after_purchase(
        user_id: int,
        purchase_amount: float,
        session: AsyncSession
) -> VipLevel:
    """
    Оновити VIP статус користувача після покупки

    Args:
        user_id: ID користувача
        purchase_amount: Сума покупки в USD
        session: Сесія бази даних

    Returns:
        Новий VIP рівень користувача
    """

    try:
        # Отримуємо користувача
        user = await session.get(User, user_id)
        if not user:
            logger.error(f"User {user_id} not found")
            return VipLevel.NONE

        # Оновлюємо загальну суму витрат
        user.total_spent += purchase_amount

        # Визначаємо новий VIP рівень
        old_level = user.vip_level
        new_level = calculate_vip_level(user.total_spent)

        # Якщо рівень змінився
        if new_level != old_level:
            user.vip_level = new_level
            logger.info(f"User {user_id} VIP level upgraded from {old_level} to {new_level}")

            # Тут можна додати відправку повідомлення про підвищення рівня
            # await send_vip_upgrade_notification(user_id, old_level, new_level)

        await session.commit()
        return new_level

    except Exception as e:
        logger.error(f"Error updating VIP status for user {user_id}: {e}")
        await session.rollback()
        return 'none'


def calculate_vip_level(total_spent: float) -> VipLevel:
    """
    Розрахувати VIP рівень на основі загальної суми витрат

    Args:
        total_spent: Загальна сума витрат в USD

    Returns:
        VIP рівень
    """

    if total_spent >= settings.VIP_DIAMOND_THRESHOLD:
        return VipLevel.DIAMOND
    elif total_spent >= settings.VIP_GOLD_THRESHOLD:
        return VipLevel.GOLD
    elif total_spent >= settings.VIP_SILVER_THRESHOLD:
        return VipLevel.SILVER
    elif total_spent > 0:
        return 'bronze'
    else:
        return 'none'


def get_vip_cashback_rate(vip_level: VipLevel) -> float:
    """
    Отримати відсоток кешбеку для VIP рівня

    Args:
        vip_level: VIP рівень користувача

    Returns:
        Відсоток кешбеку (0.0 - 1.0)
    """

    cashback_rates = {
        'none': 0.0,
        'bronze': settings.VIP_BRONZE_CASHBACK,
        'silver': settings.VIP_SILVER_CASHBACK,
        'gold': settings.VIP_GOLD_CASHBACK,
        'diamond': settings.VIP_DIAMOND_CASHBACK
    }

    return cashback_rates.get(vip_level, 0.0)


def get_vip_benefits(vip_level: VipLevel) -> dict:
    """
    Отримати переваги для VIP рівня

    Args:
        vip_level: VIP рівень

    Returns:
        Словник з перевагами
    """

    benefits = {
        'none': {
            "cashback": 0,
            "priority_support": False,
            "exclusive_content": False,
            "early_access": False,
            "bonus_multiplier": 1.0
        },
        'bronze': {
            "cashback": int(settings.VIP_BRONZE_CASHBACK * 100),
            "priority_support": False,
            "exclusive_content": False,
            "early_access": False,
            "bonus_multiplier": 1.1
        },
        'silver': {
            "cashback": int(settings.VIP_SILVER_CASHBACK * 100),
            "priority_support": True,
            "exclusive_content": False,
            "early_access": False,
            "bonus_multiplier": 1.2
        },
        'gold': {
            "cashback": int(settings.VIP_GOLD_CASHBACK * 100),
            "priority_support": True,
            "exclusive_content": True,
            "early_access": False,
            "bonus_multiplier": 1.3
        },
        'diamond': {
            "cashback": int(settings.VIP_DIAMOND_CASHBACK * 100),
            "priority_support": True,
            "exclusive_content": True,
            "early_access": True,
            "bonus_multiplier": 1.5
        }
    }

    return benefits.get(vip_level, benefits['none'])


async def calculate_cashback_amount(
        user_id: int,
        purchase_amount: float,
        session: AsyncSession
) -> int:
    """
    Розрахувати суму кешбеку в бонусах

    Args:
        user_id: ID користувача
        purchase_amount: Сума покупки в USD
        session: Сесія бази даних

    Returns:
        Кількість бонусів кешбеку
    """

    user = await session.get(User, user_id)
    if not user:
        return 0

    cashback_rate = get_vip_cashback_rate(user.vip_level)
    cashback_usd = purchase_amount * cashback_rate
    cashback_bonuses = int(cashback_usd * settings.BONUSES_PER_USD)

    return cashback_bonuses