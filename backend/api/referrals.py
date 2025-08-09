# backend/api/referrals.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc
from database import get_session
from models.user import User
from models.bonus import UserReferral, BonusTransaction, BonusTransactionType
from config import settings
from .auth import get_current_user_dependency
from typing import Optional
from datetime import datetime, timedelta

router = APIRouter()


@router.get("/my-code")
async def get_my_referral_code(
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Отримати свій реферальний код та посилання"""

    # Генеруємо посилання для Telegram
    bot_username = settings.TELEGRAM_BOT_USERNAME
    ref_link = f"https://t.me/{bot_username}?start={current_user.referral_code}"

    # Рахуємо статистику
    referrals_result = await session.execute(
        select(UserReferral).where(UserReferral.referrer_id == current_user.id)
    )
    referrals = referrals_result.scalars().all()

    total_invited = len(referrals)
    active_referrals = len([r for r in referrals if r.first_purchase_made])
    total_earned = sum(r.bonuses_earned for r in referrals)

    return {
        "referral_code": current_user.referral_code,
        "referral_link": ref_link,
        "share_text": f"🎁 Отримай 20 бонусів в RevitBot!\n\n🔗 Переходь за посиланням:\n{ref_link}\n\n💎 Бонуси можна використати для покупки архівів або підписки!",
        "statistics": {
            "total_invited": total_invited,
            "active_referrals": active_referrals,
            "total_earned": total_earned,
            "potential_earnings": (total_invited - active_referrals) * settings.BONUS_PER_REFERRAL
        }
    }


@router.post("/apply-code")
async def apply_referral_code(
        data: dict,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Застосувати реферальний код (для нових користувачів)"""

    referral_code = data.get("code", "").strip().upper()

    if not referral_code:
        raise HTTPException(status_code=400, detail="Referral code is required")

    # Перевіряємо чи користувач вже використав реферальний код
    if current_user.referred_by:
        raise HTTPException(status_code=400, detail="You have already used a referral code")

    # Перевіряємо чи існує реферальний зв'язок
    existing_referral = await session.execute(
        select(UserReferral).where(UserReferral.referred_id == current_user.id)
    )
    if existing_referral.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You have already been referred")

    # Знаходимо власника коду
    referrer_result = await session.execute(
        select(User).where(
            User.referral_code == referral_code,
            User.id != current_user.id  # Не можна використати свій код
        )
    )
    referrer = referrer_result.scalar_one_or_none()

    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")

    # Створюємо реферальний зв'язок
    referral = UserReferral(
        referrer_id=referrer.id,
        referred_id=current_user.id
    )
    session.add(referral)

    # Оновлюємо користувача
    current_user.referred_by = referrer.id

    # Нараховуємо welcome бонуси новому користувачу
    welcome_bonus = settings.WELCOME_BONUS_AMOUNT
    if welcome_bonus > 0:
        current_user.bonuses += welcome_bonus
        current_user.total_bonuses_earned += welcome_bonus

        # Записуємо транзакцію
        transaction = BonusTransaction(
            user_id=current_user.id,
            amount=welcome_bonus,
            balance_after=current_user.bonuses,
            type=BonusTransactionType.REFERRAL_BONUS,
            description=f"Welcome bonus from referral"
        )
        session.add(transaction)

    # Оновлюємо статистику рефера
    referrer.invited_count += 1

    await session.commit()

    return {
        "success": True,
        "message": f"Referral code applied successfully!",
        "welcome_bonus": welcome_bonus,
        "referrer": {
            "username": referrer.username,
            "full_name": referrer.full_name
        }
    }


@router.get("/my-referrals")
async def get_my_referrals(
        page: int = Query(1, ge=1),
        limit: int = Query(20, ge=1, le=100),
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Отримати список своїх рефералів"""

    offset = (page - 1) * limit

    # Отримуємо рефералів з користувачами
    query = select(UserReferral, User).join(
        User, UserReferral.referred_id == User.id
    ).where(
        UserReferral.referrer_id == current_user.id
    ).order_by(UserReferral.created_at.desc())

    # Загальна кількість
    total_result = await session.execute(
        select(func.count(UserReferral.id)).where(
            UserReferral.referrer_id == current_user.id
        )
    )
    total = total_result.scalar_one()

    # Рефералі з пагінацією
    referrals_result = await session.execute(
        query.offset(offset).limit(limit)
    )

    referrals_data = []
    for referral, user in referrals_result.all():
        referrals_data.append({
            "id": referral.id,
            "user": {
                "username": user.username,
                "full_name": user.full_name,
                "avatar": f"https://ui-avatars.com/api/?name={user.full_name}&background=667eea&color=fff"
            },
            "registered_at": referral.created_at.isoformat(),
            "first_purchase_made": referral.first_purchase_made,
            "first_purchase_date": referral.first_purchase_date.isoformat() if referral.first_purchase_date else None,
            "total_purchases": referral.total_purchases,
            "total_spent": referral.total_spent,
            "your_earnings": referral.bonuses_earned,
            "status": "active" if referral.first_purchase_made else "pending"
        })

    # Статистика
    stats_result = await session.execute(
        select(
            func.count(UserReferral.id).label('total'),
            func.count(UserReferral.id).filter(UserReferral.first_purchase_made == True).label('active'),
            func.sum(UserReferral.bonuses_earned).label('earned')
        ).where(UserReferral.referrer_id == current_user.id)
    )
    stats = stats_result.one()

    return {
        "referrals": referrals_data,
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        },
        "statistics": {
            "total": stats.total,
            "active": stats.active,
            "pending": stats.total - stats.active,
            "total_earned": stats.earned or 0,
            "average_earning": (stats.earned or 0) / max(stats.active, 1) if stats.active else 0
        }
    }


@router.get("/leaderboard")
async def get_referral_leaderboard(
        period: str = Query("all", regex="^(week|month|all)$"),
        limit: int = Query(10, ge=1, le=50),
        session: AsyncSession = Depends(get_session)
):
    """Отримати лідерборд реферальної програми"""

    # Базовий запит
    query = select(
        User.id,
        User.username,
        User.full_name,
        func.count(UserReferral.id).label('referrals_count'),
        func.sum(UserReferral.bonuses_earned).label('total_earned')
    ).join(
        UserReferral, User.id == UserReferral.referrer_id
    )

    # Фільтр за періодом
    if period == "week":
        date_from = datetime.utcnow() - timedelta(days=7)
        query = query.where(UserReferral.created_at >= date_from)
    elif period == "month":
        date_from = datetime.utcnow() - timedelta(days=30)
        query = query.where(UserReferral.created_at >= date_from)

    # Групування та сортування
    query = query.group_by(User.id, User.username, User.full_name) \
        .order_by(desc('referrals_count')) \
        .limit(limit)

    result = await session.execute(query)

    leaderboard = []
    for idx, row in enumerate(result.all(), 1):
        leaderboard.append({
            "position": idx,
            "user": {
                "id": row.id,
                "username": row.username,
                "full_name": row.full_name,
                "avatar": f"https://ui-avatars.com/api/?name={row.full_name}&background=667eea&color=fff"
            },
            "referrals_count": row.referrals_count,
            "total_earned": row.total_earned or 0,
            "badge": get_referral_badge(row.referrals_count)
        })

    return {
        "period": period,
        "leaderboard": leaderboard
    }


@router.post("/process-first-purchase")
async def process_referral_first_purchase(
        order_id: int,
        session: AsyncSession = Depends(get_session)
):
    """Обробити першу покупку реферала (викликається з orders API)"""

    from models.order import Order

    # Отримуємо замовлення
    order_result = await session.execute(
        select(Order).where(Order.id == order_id)
    )
    order = order_result.scalar_one_or_none()

    if not order:
        return {"success": False, "message": "Order not found"}

    # Отримуємо користувача
    user_result = await session.execute(
        select(User).where(User.id == order.user_id)
    )
    user = user_result.scalar_one_or_none()

    if not user or not user.referred_by:
        return {"success": False, "message": "No referral found"}

    # Перевіряємо реферальний зв'язок
    referral_result = await session.execute(
        select(UserReferral).where(
            UserReferral.referred_id == user.id
        )
    )
    referral = referral_result.scalar_one_or_none()

    if not referral:
        return {"success": False, "message": "Referral link not found"}

    # Якщо це перша покупка
    if not referral.first_purchase_made:
        # Отримуємо реферера
        referrer_result = await session.execute(
            select(User).where(User.id == referral.referrer_id)
        )
        referrer = referrer_result.scalar_one_or_none()

        if referrer:
            # Нараховуємо бонус за першу покупку
            first_purchase_bonus = settings.BONUS_PER_REFERRAL
            referrer.bonuses += first_purchase_bonus
            referrer.total_bonuses_earned += first_purchase_bonus
            referrer.referral_earnings += first_purchase_bonus

            # Записуємо транзакцію
            transaction = BonusTransaction(
                user_id=referrer.id,
                amount=first_purchase_bonus,
                balance_after=referrer.bonuses,
                type=BonusTransactionType.REFERRAL_BONUS,
                description=f"Referral first purchase by @{user.username or 'user'}",
                referral_id=user.id
            )
            session.add(transaction)

            # Оновлюємо реферальний зв'язок
            referral.first_purchase_made = True
            referral.first_purchase_date = datetime.utcnow()
            referral.bonuses_earned += first_purchase_bonus

    # Нараховуємо процент від покупки
    if settings.REFERRAL_PURCHASE_PERCENT > 0:
        referrer_result = await session.execute(
            select(User).where(User.id == referral.referrer_id)
        )
        referrer = referrer_result.scalar_one_or_none()

        if referrer:
            purchase_bonus = int(order.total * settings.REFERRAL_PURCHASE_PERCENT)
            if purchase_bonus > 0:
                referrer.bonuses += purchase_bonus
                referrer.total_bonuses_earned += purchase_bonus
                referrer.referral_earnings += purchase_bonus

                # Записуємо транзакцію
                transaction = BonusTransaction(
                    user_id=referrer.id,
                    amount=purchase_bonus,
                    balance_after=referrer.bonuses,
                    type=BonusTransactionType.REFERRAL_PURCHASE,
                    description=f"5% from referral purchase #{order.order_id}",
                    referral_id=user.id,
                    order_id=order.id
                )
                session.add(transaction)

                # Оновлюємо статистику реферального зв'язку
                referral.total_purchases += 1
                referral.total_spent += order.total
                referral.bonuses_earned += purchase_bonus
                referral.total_earned += order.total * settings.REFERRAL_PURCHASE_PERCENT

    await session.commit()

    return {"success": True, "message": "Referral bonuses processed"}


def get_referral_badge(count: int) -> dict:
    """Отримати бейдж за кількість рефералів"""
    if count >= 100:
        return {"emoji": "👑", "name": "Referral King", "color": "#FFD700"}
    elif count >= 50:
        return {"emoji": "💎", "name": "Diamond Referrer", "color": "#B9F2FF"}
    elif count >= 25:
        return {"emoji": "🏆", "name": "Gold Referrer", "color": "#FFD700"}
    elif count >= 10:
        return {"emoji": "🥈", "name": "Silver Referrer", "color": "#C0C0C0"}
    elif count >= 5:
        return {"emoji": "🥉", "name": "Bronze Referrer", "color": "#CD7F32"}
    else:
        return {"emoji": "⭐", "name": "Starter", "color": "#667eea"}
