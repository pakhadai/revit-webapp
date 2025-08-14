# backend/api/bonuses.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date, timedelta
import random

from database import get_session
from models.user import User
from models.bonus import DailyBonus, BonusTransaction, BonusTransactionType
from utils.timezone import get_kyiv_time
from .dependencies import get_current_user_dependency
from config import settings

router = APIRouter()

# Винагороди за стрік
STREAK_REWARDS = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 7, 7: 10}

def get_reward_for_day(day: int) -> int:
    return STREAK_REWARDS.get(day, 10)

@router.get("/daily-bonus")
async def get_daily_bonus_status(
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    today = get_kyiv_time().date()

    result = await session.execute(select(DailyBonus).where(DailyBonus.user_id == current_user.id))
    bonus_status = result.scalar_one_or_none()

    if not bonus_status:
        return {
            "can_claim": True, "current_streak": 0, "next_reward": get_reward_for_day(1),
            "streak_broken": False, "can_restore": False
        }

    can_claim = bonus_status.last_claim_date is None or bonus_status.last_claim_date < today

    time_since_last_claim = today - (bonus_status.last_claim_date or today)
    streak_broken = time_since_last_claim > timedelta(days=1)

    current_streak = 0 if streak_broken else bonus_status.streak_count
    next_reward = get_reward_for_day(current_streak + 1)

    can_restore = streak_broken and not bonus_status.streak_restored and current_user.bonuses >= settings.DAILY_BONUS_STREAK_RESTORE_COST

    return {
        "can_claim": can_claim,
        "current_streak": current_streak,
        "next_reward": next_reward,
        "streak_broken": streak_broken,
        "can_restore": can_restore,
        "restore_cost": settings.DAILY_BONUS_STREAK_RESTORE_COST
    }

@router.post("/daily/claim")
async def claim_daily_bonus(
        data: dict,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    status = await get_daily_bonus_status(current_user, session)
    if not status["can_claim"]:
        raise HTTPException(status_code=400, detail="Bonus already claimed today.")

    slot_result = data.get("slot_result", [])
    base_reward = status["next_reward"]
    jackpot_bonus = 0
    is_jackpot = len(slot_result) == 3 and slot_result[0] == slot_result[1] == slot_result[2]

    if is_jackpot:
        jackpot_bonus = settings.DAILY_BONUS_SLOT_JACKPOT

    total_reward = base_reward + jackpot_bonus

    # Оновлюємо або створюємо запис DailyBonus
    result = await session.execute(select(DailyBonus).where(DailyBonus.user_id == current_user.id))
    bonus_status = result.scalar_one_or_none()

    if not bonus_status:
        bonus_status = DailyBonus(user_id=current_user.id, streak_count=0)
        session.add(bonus_status)

    new_streak = status["current_streak"] + 1
    bonus_status.streak_count = new_streak
    bonus_status.last_claim_date = get_kyiv_time().date()
    bonus_status.streak_restored = False

    bonus_status.total_claimed = (bonus_status.total_claimed or 0) + total_reward
    bonus_status.total_claims = (bonus_status.total_claims or 0) + 1
    if is_jackpot:
        bonus_status.slot_wins = (bonus_status.slot_wins or 0) + 1

    # Нараховуємо бонуси
    current_user.bonuses += total_reward
    session.add(BonusTransaction(
        user_id=current_user.id, amount=total_reward, balance_after=current_user.bonuses,
        type=BonusTransactionType.DAILY_CLAIM, description=f"Daily bonus day {new_streak}. Jackpot: {is_jackpot}"
    ))

    await session.commit()

    return {
        "success": True, "total_reward": total_reward, "base_reward": base_reward,
        "jackpot": is_jackpot, "jackpot_bonus": jackpot_bonus,
        "new_balance": current_user.bonuses, "streak_day": new_streak
    }

@router.post("/daily/restore-streak")
async def restore_streak(
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    status = await get_daily_bonus_status(current_user, session)
    if not status["can_restore"]:
        raise HTTPException(status_code=400, detail="Cannot restore streak.")

    cost = settings.DAILY_BONUS_STREAK_RESTORE_COST

    result = await session.execute(select(DailyBonus).where(DailyBonus.user_id == current_user.id))
    bonus_status = result.scalar_one()

    # Списуємо бонуси
    current_user.bonuses -= cost
    session.add(BonusTransaction(
        user_id=current_user.id, amount=-cost, balance_after=current_user.bonuses,
        type=BonusTransactionType.STREAK_RESTORE_FEE, description="Streak restore fee"
    ))

    # Відновлюємо
    bonus_status.last_claim_date = get_kyiv_time().date() - timedelta(days=1)
    bonus_status.streak_restored = True

    await session.commit()

    return {"success": True, "new_balance": current_user.bonuses, "message": "Streak restored."}