# backend/api/bonuses.py - ВИПРАВЛЕНА ВЕРСІЯ

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta

# Локальні імпорти
from database import get_session
from models.user import User
from models.bonus import DailyBonus
from utils.timezone import get_kyiv_time

# --- ОСНОВНЕ ВИПРАВЛЕННЯ ТУТ ---
# Імпортуємо правильну функцію `get_current_user_dependency`
from .dependencies import get_current_user_dependency

router = APIRouter()


async def _get_bonus_status(user_id: int, session: AsyncSession):
    """Асинхронно перевіряє, чи може користувач отримати щоденний бонус."""
    now = get_kyiv_time()
    result = await session.execute(
        select(DailyBonus).filter(DailyBonus.user_id == user_id)
    )
    last_claim = result.scalar_one_or_none()

    if last_claim:
        # Переконуємось, що last_claimed_at має часову зону
        last_claimed_at = last_claim.last_claimed_at
        if hasattr(last_claimed_at, 'tzinfo') and last_claimed_at.tzinfo is None:
            # Якщо це datetime.date, то просто порівнюємо дати
            if isinstance(last_claimed_at, datetime.date) and not isinstance(last_claimed_at, datetime):
                if last_claimed_at >= now.date():
                    return {"can_claim": False, "time_left": 86400}  # Приблизний час до наступного дня
            else:
                # Це datetime без tzinfo
                last_claimed_at = KYIV_TZ.localize(last_claimed_at)

        time_since_claim = now - last_claimed_at
        if time_since_claim < timedelta(days=1):
            time_left = timedelta(days=1) - time_since_claim
            return {"can_claim": False, "time_left": int(time_left.total_seconds())}

    return {"can_claim": True, "time_left": 0}


@router.get("/daily-bonus", summary="Отримати статус щоденного бонусу")
async def get_daily_bonus_status(
        # Використовуємо правильну назву функції
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Кінцева точка API для перевірки статусу щоденного бонусу."""
    return await _get_bonus_status(current_user.id, session)


@router.post("/daily-bonus", summary="Отримати щоденний бонус")
async def claim_daily_bonus(
        # І тут також використовуємо правильну назву
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Кінцева точка API для отримання щоденного бонусу."""
    status_data = await _get_bonus_status(current_user.id, session)
    if not status_data['can_claim']:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bonus already claimed today.")

    bonus_amount = 10  # TODO: Зробити динамічним

    # Використовуємо існуючий об'єкт користувача
    user_to_update = current_user
    user_to_update.bonuses += bonus_amount

    result = await session.execute(
        select(DailyBonus).filter(DailyBonus.user_id == user_to_update.id)
    )
    last_claim = result.scalar_one_or_none()
    now = get_kyiv_time()

    if last_claim:
        last_claim.last_claim_date = now.date()
        last_claim.streak_count += 1  # TODO: Додати логіку перевірки стріку
    else:
        new_claim = DailyBonus(user_id=user_to_update.id, last_claim_date=now.date(), streak_count=1)
        session.add(new_claim)

    # Мерджимо зміни в сесію
    session.add(user_to_update)
    await session.commit()
    await session.refresh(user_to_update)

    return {"message": "Bonus claimed successfully", "new_balance": user_to_update.bonuses}