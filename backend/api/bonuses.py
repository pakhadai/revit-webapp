# backend/api/bonuses.py

# --- ДОДАНО ВІДСУТНІ ІМПОРТИ ---
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta, timezone

from database import get_session
from models.user import User
from models.bonus import DailyBonus, BonusTransaction, BonusTransactionType
from .auth import get_current_user_dependency
from utils.timezone import get_kyiv_time, get_kyiv_midnight, seconds_until_kyiv_midnight, utc_to_kyiv

# --- ДОДАНО СТВОРЕННЯ РОУТЕРА ---
router = APIRouter()


@router.get("/daily/status")
async def get_daily_bonus_status(
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session)
):
    """Get the current status of the daily bonus for the user."""
    # This logic can be expanded later, for now, we'll return a basic status
    # to fix the 404 error and allow the block to render.
    # A more complete implementation would check the last claim date.
    return {
        "can_claim": True, # Placeholder logic
        "current_streak": 0,
        "next_reward": 10,
        "streak_broken": False,
        "can_restore": False,
        "restore_cost": 30
    }

@router.post("/daily-bonus")
async def claim_daily_bonus(
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Отримати щоденний бонус (за київським часом)"""

    # Отримуємо поточний київський час
    kyiv_now = get_kyiv_time()
    kyiv_today = kyiv_now.date()

    # Перевіряємо чи вже отримували сьогодні
    result = await session.execute(
        select(DailyBonus).where(
            DailyBonus.user_id == current_user.id
        ).order_by(DailyBonus.claimed_at.desc())
    )
    last_claim = result.scalar_one_or_none()

    if last_claim:
        # Конвертуємо час останнього отримання в київський
        last_claim_kyiv = utc_to_kyiv(last_claim.claimed_at)

        # Якщо вже отримували сьогодні за київським часом
        if last_claim_kyiv.date() == kyiv_today:
            seconds_left = seconds_until_kyiv_midnight()
            hours_left = seconds_left // 3600
            minutes_left = (seconds_left % 3600) // 60

            raise HTTPException(
                status_code=400,
                detail=f"Ви вже отримали бонус сьогодні. Наступний через {hours_left}г {minutes_left}хв"
            )

        # Перевіряємо стрік (чи отримували вчора)
        yesterday = kyiv_today - timedelta(days=1)
        if last_claim_kyiv.date() == yesterday:
            # Продовжуємо стрік
            current_streak = last_claim.streak + 1
        else:
            # Стрік скинувся
            current_streak = 1
    else:
        # Перший бонус
        current_streak = 1

    # Визначаємо розмір бонусу залежно від стріку
    bonus_amounts = {
        1: 1,  # День 1
        2: 2,  # День 2
        3: 3,  # День 3
        4: 4,  # День 4
        5: 5,  # День 5
        6: 7,  # День 6
        7: 10,  # День 7 - максимальний бонус
    }

    # Після 7 днів стрік продовжується, але бонус залишається 50
    if current_streak <= 7:
        bonus_amount = bonus_amounts[current_streak]
    else:
        bonus_amount = 10

    # Нараховуємо бонуси
    current_user.bonuses += bonus_amount
    current_user.total_bonuses_earned += bonus_amount

    # Записуємо в історію
    daily_bonus_record = DailyBonus(
        user_id=current_user.id,
        amount=bonus_amount,
        streak=current_streak,
        claimed_at=datetime.now(timezone.utc)  # Зберігаємо в UTC
    )
    session.add(daily_bonus_record)

    # Записуємо транзакцію
    transaction = BonusTransaction(
        user_id=current_user.id,
        amount=bonus_amount,
        balance_after=current_user.bonuses,
        type=BonusTransactionType.DAILY_CLAIM,
        description=f"Щоденний бонус, день {current_streak}"
    )
    session.add(transaction)

    await session.commit()

    # Визначаємо завтрашній бонус
    tomorrow_streak = current_streak + 1
    tomorrow_bonus = bonus_amounts.get(tomorrow_streak, 50)


    # Час до наступного бонусу
    seconds_left = seconds_until_kyiv_midnight()

    return {
        "success": True,
        "amount": bonus_amount,
        "streak": current_streak,
        "new_balance": current_user.bonuses,
        "tomorrow_bonus": tomorrow_bonus,
        "next_claim_in_seconds": seconds_left,
        "next_claim_time": get_kyiv_midnight().isoformat()
    }