# backend/api/bonuses.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from database import get_session
from models.user import User
from models.bonus import DailyBonus, BonusTransaction, BonusTransactionType, VipLevel
from config import settings
from .auth import get_current_user_dependency
from datetime import datetime, date, timedelta
import pytz
import random
import json

router = APIRouter()

# Часова зона Києва
KYIV_TZ = pytz.timezone(settings.DAILY_RESET_TIMEZONE)

# Емодзі для слот-машини
SLOT_EMOJIS = ['🍎', '🍋', '🍒', '🍇', '🍊', '🍉', '⭐']

# Таблиця винагород за стрік
STREAK_REWARDS = {
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 7,
    7: 10,
    # 8+ днів = 10 бонусів
}


def get_kyiv_date():
    """Отримати поточну дату за київським часом"""
    return datetime.now(KYIV_TZ).date()


def get_streak_reward(streak_day: int) -> int:
    """Отримати кількість бонусів за день стріку"""
    if streak_day >= 7:
        return 10
    return STREAK_REWARDS.get(streak_day, 10)


@router.get("/daily/status")
async def get_daily_bonus_status(
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Отримати статус щоденного бонусу"""

    # Отримуємо або створюємо запис щоденних бонусів
    result = await session.execute(
        select(DailyBonus).where(DailyBonus.user_id == current_user.id)
    )
    daily_bonus = result.scalar_one_or_none()

    if not daily_bonus:
        daily_bonus = DailyBonus(
            user_id=current_user.id,
            streak_count=0,
            total_claimed=0,
            total_claims=0,
            slot_wins=0
        )
        session.add(daily_bonus)
        await session.commit()
        await session.refresh(daily_bonus)

    today = get_kyiv_date()
    can_claim = False
    streak_broken = False
    can_restore = False

    if daily_bonus.last_claim_date:
        days_diff = (today - daily_bonus.last_claim_date).days

        if days_diff == 0:
            # Вже отримано сьогодні
            can_claim = False
        elif days_diff == 1:
            # Можна отримати, стрік продовжується
            can_claim = True
        elif days_diff == 2:
            # Пропущено 1 день, можна відновити
            can_claim = True
            streak_broken = True
            can_restore = not daily_bonus.streak_restored  # Можна відновити тільки раз
        else:
            # Пропущено більше 1 дня, стрік втрачено
            can_claim = True
            streak_broken = True
            can_restore = False
    else:
        # Перший раз
        can_claim = True

    # Розраховуємо наступну винагороду
    next_streak = daily_bonus.streak_count + 1 if not streak_broken else 1
    next_reward = get_streak_reward(next_streak)

    return {
        "can_claim": can_claim,
        "current_streak": daily_bonus.streak_count,
        "next_streak": next_streak if not streak_broken else 1,
        "next_reward": next_reward,
        "total_claimed": daily_bonus.total_claimed,
        "total_claims": daily_bonus.total_claims,
        "slot_wins": daily_bonus.slot_wins,
        "max_streak": daily_bonus.max_streak,
        "last_claim_date": daily_bonus.last_claim_date.isoformat() if daily_bonus.last_claim_date else None,
        "streak_broken": streak_broken,
        "can_restore": can_restore,
        "restore_cost": settings.DAILY_BONUS_STREAK_RESTORE_COST if can_restore else None,
        "today": today.isoformat()
    }


@router.post("/daily/claim")
async def claim_daily_bonus(
        data: dict,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Отримати щоденний бонус після гри в слот"""

    slot_result = data.get("slot_result", [])

    # Перевіряємо результат слоту (3 емодзі)
    if len(slot_result) != 3 or not all(emoji in SLOT_EMOJIS for emoji in slot_result):
        raise HTTPException(status_code=400, detail="Invalid slot result")

    # Отримуємо запис щоденних бонусів
    result = await session.execute(
        select(DailyBonus).where(DailyBonus.user_id == current_user.id)
    )
    daily_bonus = result.scalar_one_or_none()

    if not daily_bonus:
        daily_bonus = DailyBonus(
            user_id=current_user.id,
            streak_count=0,
            total_claimed=0,
            total_claims=0
        )
        session.add(daily_bonus)

    today = get_kyiv_date()

    # Перевіряємо чи можна отримати
    if daily_bonus.last_claim_date:
        days_diff = (today - daily_bonus.last_claim_date).days
        if days_diff == 0:
            raise HTTPException(status_code=400, detail="Already claimed today")
        elif days_diff > 2:
            # Стрік втрачено повністю
            daily_bonus.streak_count = 0
            daily_bonus.streak_restored = False
        elif days_diff == 2:
            # Можна відновити або почати з початку
            if not data.get("restore_streak"):
                daily_bonus.streak_count = 0
                daily_bonus.streak_restored = False

    # Оновлюємо стрік
    daily_bonus.streak_count += 1
    daily_bonus.last_claim_date = today

    # Розраховуємо базову винагороду
    base_reward = get_streak_reward(daily_bonus.streak_count)

    # Перевіряємо чи виграв джекпот (3 однакових)
    is_jackpot = len(set(slot_result)) == 1
    jackpot_bonus = 0

    if is_jackpot:
        # Перевіряємо шанс джекпоту (0.5%)
        if random.random() <= settings.DAILY_BONUS_SLOT_JACKPOT_CHANCE:
            jackpot_bonus = settings.DAILY_BONUS_SLOT_JACKPOT
            daily_bonus.slot_wins += 1

    total_reward = base_reward + jackpot_bonus

    # Оновлюємо статистику
    daily_bonus.total_claimed += total_reward
    daily_bonus.total_claims += 1
    daily_bonus.last_slot_result = json.dumps(slot_result)

    if daily_bonus.streak_count > daily_bonus.max_streak:
        daily_bonus.max_streak = daily_bonus.streak_count

    # Нараховуємо бонуси користувачу
    current_user.bonuses += total_reward
    current_user.total_bonuses_earned += total_reward

    # Записуємо транзакцію
    transaction = BonusTransaction(
        user_id=current_user.id,
        amount=total_reward,
        balance_after=current_user.bonuses,
        type=BonusTransactionType.DAILY_CLAIM if not is_jackpot else BonusTransactionType.SLOT_JACKPOT,
        description=f"Daily bonus day {daily_bonus.streak_count}" + (f" + JACKPOT!" if is_jackpot else "")
    )
    session.add(transaction)

    await session.commit()

    return {
        "success": True,
        "streak_day": daily_bonus.streak_count,
        "base_reward": base_reward,
        "jackpot": is_jackpot,
        "jackpot_bonus": jackpot_bonus,
        "total_reward": total_reward,
        "new_balance": current_user.bonuses,
        "slot_result": slot_result,
        "animation_type": "jackpot" if is_jackpot else "normal"
    }


@router.post("/daily/restore-streak")
async def restore_streak(
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Відновити втрачений стрік за бонуси"""

    result = await session.execute(
        select(DailyBonus).where(DailyBonus.user_id == current_user.id)
    )
    daily_bonus = result.scalar_one_or_none()

    if not daily_bonus:
        raise HTTPException(status_code=400, detail="No daily bonus record")

    today = get_kyiv_date()

    # Перевіряємо чи можна відновити
    if not daily_bonus.last_claim_date:
        raise HTTPException(status_code=400, detail="No streak to restore")

    days_diff = (today - daily_bonus.last_claim_date).days

    if days_diff != 2:
        raise HTTPException(status_code=400, detail="Can only restore streak after missing 1 day")

    if daily_bonus.streak_restored:
        raise HTTPException(status_code=400, detail="Streak already restored once")

    # Перевіряємо баланс
    restore_cost = settings.DAILY_BONUS_STREAK_RESTORE_COST
    if current_user.bonuses < restore_cost:
        raise HTTPException(status_code=400, detail=f"Not enough bonuses. Need {restore_cost}")

    # Списуємо бонуси
    current_user.bonuses -= restore_cost
    current_user.total_bonuses_spent += restore_cost

    # Позначаємо що стрік відновлено
    daily_bonus.streak_restored = True
    daily_bonus.last_claim_date = today - timedelta(days=1)  # Вчорашня дата

    # Записуємо транзакцію
    transaction = BonusTransaction(
        user_id=current_user.id,
        amount=-restore_cost,
        balance_after=current_user.bonuses,
        type=BonusTransactionType.STREAK_RESTORE_FEE,
        description=f"Streak restore for day {daily_bonus.streak_count}"
    )
    session.add(transaction)

    await session.commit()

    return {
        "success": True,
        "message": "Streak restored successfully",
        "streak_count": daily_bonus.streak_count,
        "cost": restore_cost,
        "new_balance": current_user.bonuses
    }


@router.get("/balance")
async def get_bonus_balance(
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Отримати баланс та статистику бонусів"""

    # Отримуємо VIP рівень
    vip_result = await session.execute(
        select(VipLevel).where(VipLevel.user_id == current_user.id)
    )
    vip_level = vip_result.scalar_one_or_none()

    if not vip_level:
        vip_level = VipLevel(
            user_id=current_user.id,
            total_spent=0,
            current_level='bronze',
            cashback_rate=settings.VIP_BRONZE_CASHBACK
        )
        session.add(vip_level)
        await session.commit()
        await session.refresh(vip_level)

    # Визначаємо наступний рівень
    next_level_info = None
    if vip_level.current_level == 'bronze' and vip_level.total_spent < settings.VIP_SILVER_THRESHOLD:
        next_level_info = {
            "level": "silver",
            "required": settings.VIP_SILVER_THRESHOLD,
            "need_more": settings.VIP_SILVER_THRESHOLD - vip_level.total_spent,
            "cashback": settings.VIP_SILVER_CASHBACK * 100
        }
    elif vip_level.current_level == 'silver' and vip_level.total_spent < settings.VIP_GOLD_THRESHOLD:
        next_level_info = {
            "level": "gold",
            "required": settings.VIP_GOLD_THRESHOLD,
            "need_more": settings.VIP_GOLD_THRESHOLD - vip_level.total_spent,
            "cashback": settings.VIP_GOLD_CASHBACK * 100
        }
    elif vip_level.current_level == 'gold' and vip_level.total_spent < settings.VIP_DIAMOND_THRESHOLD:
        next_level_info = {
            "level": "diamond",
            "required": settings.VIP_DIAMOND_THRESHOLD,
            "need_more": settings.VIP_DIAMOND_THRESHOLD - vip_level.total_spent,
            "cashback": settings.VIP_DIAMOND_CASHBACK * 100
        }

    return {
        "balance": current_user.bonuses,
        "total_earned": current_user.total_bonuses_earned,
        "total_spent": current_user.total_bonuses_spent,
        "referral_earnings": current_user.referral_earnings,
        "vip": {
            "level": vip_level.current_level,
            "cashback_rate": vip_level.cashback_rate * 100,
            "total_spent": vip_level.total_spent,
            "total_cashback_earned": vip_level.total_cashback_earned,
            "next_level": next_level_info
        },
        "exchange_rate": {
            "bonuses_per_dollar": settings.BONUSES_PER_USD,
            "dollar_value": current_user.bonuses / settings.BONUSES_PER_USD
        }
    }


@router.get("/transactions")
async def get_bonus_transactions(
        limit: int = 20,
        offset: int = 0,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Отримати історію транзакцій бонусів"""

    result = await session.execute(
        select(BonusTransaction)
        .where(BonusTransaction.user_id == current_user.id)
        .order_by(BonusTransaction.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    transactions = result.scalars().all()

    return {
        "transactions": [
            {
                "id": t.id,
                "amount": t.amount,
                "type": t.type.value,
                "description": t.description,
                "balance_after": t.balance_after,
                "created_at": t.created_at.isoformat() if t.created_at else None
            }
            for t in transactions
        ]
    }