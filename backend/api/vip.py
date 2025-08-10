from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_session
from models.user import User
from models.bonus import VipLevel
from config import settings
from .auth import get_current_user_dependency

router = APIRouter()

def get_next_level_info(current_level: str, total_spent: float) -> dict | None:
    """Розраховує прогрес до наступного VIP-рівня."""
    if current_level == 'bronze':
        threshold = settings.VIP_SILVER_THRESHOLD
        next_level_name = 'silver'
        next_cashback = settings.VIP_SILVER_CASHBACK
    elif current_level == 'silver':
        threshold = settings.VIP_GOLD_THRESHOLD
        next_level_name = 'gold'
        next_cashback = settings.VIP_GOLD_CASHBACK
    elif current_level == 'gold':
        threshold = settings.VIP_DIAMOND_THRESHOLD
        next_level_name = 'diamond'
        next_cashback = settings.VIP_DIAMOND_CASHBACK
    else: # Diamond
        return None

    if total_spent >= threshold:
        return None

    return {
        "level": next_level_name,
        "required": threshold,
        "progress": (total_spent / threshold) * 100,
        "needed": threshold - total_spent,
        "cashback": next_cashback * 100
    }


@router.get("/status", tags=["vip"])
async def get_vip_status(
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session)
):
    """Отримати поточний VIP-статус, кешбек та прогрес користувача."""
    result = await session.execute(
        select(VipLevel).where(VipLevel.user_id == current_user.id)
    )
    vip_level = result.scalar_one_or_none()

    if not vip_level:
        vip_level = VipLevel(
            user_id=current_user.id,
            current_level='bronze',
            cashback_rate=settings.VIP_BRONZE_CASHBACK
        )
        session.add(vip_level)
        await session.commit()
        await session.refresh(vip_level)


    return {
        "level": vip_level.current_level,
        "cashback_rate": vip_level.cashback_rate * 100,
        "total_spent": vip_level.total_spent,
        "total_cashback_earned": vip_level.total_cashback_earned,
        "next_level_info": get_next_level_info(vip_level.current_level, vip_level.total_spent)
    }
