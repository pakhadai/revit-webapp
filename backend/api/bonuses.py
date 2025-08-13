from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta

# Локальні імпорти
from database import get_session
from models.user import User
from models.bonus import DailyBonus
from utils.timezone import get_kyiv_time

# Імпорт залежності для отримання користувача
from .dependencies import get_current_user

router = APIRouter()


async def _get_bonus_status(user_id: int, session: AsyncSession):
    """Асинхронно перевіряє, чи може користувач отримати щоденний бонус."""
    now = get_kyiv_time()
    result = await session.execute(
        select(DailyBonus).filter(DailyBonus.user_id == user_id)
    )
    last_claim = result.scalar_one_or_none()

    if last_claim:
        last_claimed_at = last_claim.last_claimed_at
        if last_claimed_at.tzinfo is None:
            last_claimed_at = get_kyiv_time().tzinfo.localize(last_claimed_at)

        time_since_claim = now - last_claimed_at
        if time_since_claim < timedelta(days=1):
            time_left = timedelta(days=1) - time_since_claim
            return {"can_claim": False, "time_left": int(time_left.total_seconds())}

    return {"can_claim": True, "time_left": 0}


@router.get("/daily-bonus", summary="Отримати статус щоденного бонусу")
async def get_daily_bonus_status(
        current_user: User = Depends(get_current_user),
        session: AsyncSession = Depends(get_session)
):
    """Кінцева точка API для перевірки статусу щоденного бонусу."""
    return await _get_bonus_status(current_user.id, session)


@router.post("/daily-bonus", summary="Отримати щоденний бонус")
async def claim_daily_bonus(
        current_user: User = Depends(get_current_user),
        session: AsyncSession = Depends(get_session)
):
    """Кінцева точка API для отримання щоденного бонусу."""
    status_data = await _get_bonus_status(current_user.id, session)
    if not status_data['can_claim']:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bonus already claimed today.")

    bonus_amount = 10
    user_to_update = await session.get(User, current_user.id)
    if not user_to_update:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user_to_update.bonus_balance += bonus_amount

    result = await session.execute(
        select(DailyBonus).filter(DailyBonus.user_id == user_to_update.id)
    )
    last_claim = result.scalar_one_or_none()
    now = get_kyiv_time()

    if last_claim:
        last_claim.last_claimed_at = now
    else:
        new_claim = DailyBonus(user_id=user_to_update.id, last_claimed_at=now)
        session.add(new_claim)

    await session.commit()
    await session.refresh(user_to_update)

    return {"message": "Bonus claimed successfully", "new_balance": user_to_update.bonus_balance}
