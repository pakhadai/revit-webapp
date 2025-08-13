# backend/api/subscriptions.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from database import get_session

from models.subscription import Subscription, SubscriptionArchive, SubscriptionStatus, SubscriptionPlan
from models.archive import Archive
from models.user import User
from models.bonus import BonusTransaction, BonusTransactionType

from config import settings
from .auth import get_current_user_dependency
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict
import pytz

router = APIRouter()

# Часова зона для розрахунків
KYIV_TZ = pytz.timezone(settings.DAILY_RESET_TIMEZONE)


@router.get("/status")
async def get_subscription_status(
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Отримати статус підписки користувача"""

    # Шукаємо активну підписку
    result = await session.execute(
        select(Subscription)
        .where(
            Subscription.user_id == current_user.id,
            Subscription.status == SubscriptionStatus.ACTIVE
        )
        .order_by(Subscription.end_date.desc())
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        return {
            "has_subscription": False,
            "message": "No active subscription"
        }

    # Перевіряємо чи не закінчилася
    now = datetime.now(timezone.utc)
    if subscription.end_date < now:
        subscription.status = SubscriptionStatus.EXPIRED
        await session.commit()
        return {
            "has_subscription": False,
            "expired": True,
            "expired_at": subscription.end_date.isoformat()
        }

    # Рахуємо дні до закінчення
    days_left = (subscription.end_date - now).days

    # Отримуємо кількість розблокованих архівів
    archives_count = await session.execute(
        select(SubscriptionArchive)
        .where(SubscriptionArchive.subscription_id == subscription.id)
    )
    unlocked_archives = len(archives_count.scalars().all())

    return {
        "has_subscription": True,
        "plan": subscription.plan.value,
        "start_date": subscription.start_date.isoformat(),
        "end_date": subscription.end_date.isoformat(),
        "days_left": days_left,
        "auto_renew": subscription.auto_renew,
        "unlocked_archives": unlocked_archives,
        "show_reminder": days_left <= 3 and not subscription.reminder_sent
    }


@router.post("/create")
async def create_subscription(
        data: dict,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Створити нову підписку З ВАЛІДАЦІЄЮ БОНУСІВ 70%"""

    plan = data.get("plan", "monthly")  # monthly або yearly
    payment_method = data.get("payment_method", "bonuses")  # bonuses, cryptomus, card

    # Перевіряємо чи немає активної підписки
    existing = await session.execute(
        select(Subscription).where(
            Subscription.user_id == current_user.id,
            Subscription.status == SubscriptionStatus.ACTIVE
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="У вас вже є активна підписка"
        )

    # Визначаємо ціну
    if plan == "yearly":
        price = settings.SUBSCRIPTION_PRICE_YEARLY  # $50
        months = 12
    else:
        price = settings.SUBSCRIPTION_PRICE_MONTHLY  # $5
        months = 1

    # Конвертуємо в бонуси
    total_in_bonuses = int(price * settings.BONUSES_PER_USD)

    # ВАЖЛИВО: Обчислюємо максимум бонусів (70%)
    max_allowed_bonuses = int(total_in_bonuses * settings.BONUS_PURCHASE_CAP)

    # Якщо оплата бонусами
    if payment_method == "bonuses":
        bonuses_to_use = int(data.get("bonuses_amount", max_allowed_bonuses))

        # Валідація 1: Не більше 70%
        if bonuses_to_use > max_allowed_bonuses:
            raise HTTPException(
                status_code=400,
                detail=f"Максимум {settings.BONUS_PURCHASE_CAP * 100:.0f}% можна оплатити бонусами. "
                       f"Для плану '{plan}' це максимум {max_allowed_bonuses} бонусів"
            )

        # Валідація 2: Достатньо бонусів
        if current_user.bonuses < bonuses_to_use:
            raise HTTPException(
                status_code=400,
                detail=f"Недостатньо бонусів. Потрібно: {bonuses_to_use}, є: {current_user.bonuses}"
            )

        # Валідація 3: Якщо використовуємо менше 70%, потрібна доплата
        if bonuses_to_use < total_in_bonuses:
            remaining_usd = (total_in_bonuses - bonuses_to_use) / settings.BONUSES_PER_USD
            raise HTTPException(
                status_code=400,
                detail=f"Підписка коштує ${price:.2f}. При оплаті {bonuses_to_use} бонусами, "
                       f"потрібно доплатити ${remaining_usd:.2f} через Cryptomus"
            )

        # Списуємо бонуси
        current_user.bonuses -= bonuses_to_use
        current_user.total_bonuses_spent += bonuses_to_use

        # Записуємо транзакцію
        transaction = BonusTransaction(
            user_id=current_user.id,
            amount=-bonuses_to_use,
            balance_after=current_user.bonuses,
            type=BonusTransactionType.SUBSCRIPTION_PAYMENT,
            description=f"Оплата підписки {plan} ({bonuses_to_use} бонусів)"
        )
        session.add(transaction)

        # Рахуємо реальну суму в USD що була оплачена
        amount_paid = bonuses_to_use / settings.BONUSES_PER_USD
    else:
        bonuses_to_use = 0
        amount_paid = price

    # Створюємо підписку
    now = datetime.now(timezone.utc)
    end_date = now + timedelta(days=30 * months)

    subscription = Subscription(
        user_id=current_user.id,
        plan=SubscriptionPlan.YEARLY if plan == "yearly" else SubscriptionPlan.MONTHLY,
        status=SubscriptionStatus.ACTIVE if payment_method == "bonuses" else SubscriptionStatus.PENDING,
        start_date=now,
        end_date=end_date,
        payment_method=payment_method,
        amount_paid=amount_paid,
        bonuses_used=bonuses_to_use,
        auto_renew=data.get("auto_renew", False)
    )

    session.add(subscription)

    # Оновлюємо статус користувача
    current_user.has_active_subscription = True
    current_user.subscription_start = now
    current_user.subscription_until = end_date

    await session.commit()
    await session.refresh(subscription)

    # Якщо оплата не бонусами - створюємо платіж
    if payment_method != "bonuses":
        # Тут буде інтеграція з Cryptomus
        return {
            "success": True,
            "subscription_id": subscription.id,
            "payment_required": True,
            "payment_url": f"/api/payments/create",  # URL для оплати
            "amount": price,
            "currency": "USD"
        }

    return {
        "success": True,
        "subscription_id": subscription.id,
        "payment_required": False,
        "start_date": subscription.start_date.isoformat(),
        "end_date": subscription.end_date.isoformat(),
        "bonuses_spent": bonuses_to_use,
        "plan": plan
    }


@router.get("/check-bonus-limit/{plan}")
async def check_subscription_bonus_limit(
        plan: str,
        current_user: User = Depends(get_current_user_dependency)
):
    """Перевірити скільки максимум бонусів можна використати для підписки"""

    if plan not in ["monthly", "yearly"]:
        raise HTTPException(status_code=400, detail="Невірний план")

    # Визначаємо ціну
    price = settings.SUBSCRIPTION_PRICE_YEARLY if plan == "yearly" else settings.SUBSCRIPTION_PRICE_MONTHLY

    # Конвертуємо в бонуси
    total_in_bonuses = int(price * settings.BONUSES_PER_USD)

    # Максимум 70%
    max_allowed_bonuses = int(total_in_bonuses * settings.BONUS_PURCHASE_CAP)

    # Обмежуємо балансом користувача
    can_use = min(max_allowed_bonuses, current_user.bonuses)

    return {
        "plan": plan,
        "price_usd": price,
        "price_in_bonuses": total_in_bonuses,
        "max_allowed_bonuses": max_allowed_bonuses,
        "user_bonuses": current_user.bonuses,
        "can_use_bonuses": can_use,
        "percentage_limit": settings.BONUS_PURCHASE_CAP * 100,
        "requires_additional_payment": can_use < total_in_bonuses,
        "additional_payment_usd": (total_in_bonuses - can_use) / settings.BONUSES_PER_USD if can_use < total_in_bonuses else 0
    }


@router.get("/available-archives")
async def get_available_archives(
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Отримати список архівів доступних по підписці"""

    # Перевіряємо активну підписку
    subscription_result = await session.execute(
        select(Subscription).where(
            Subscription.user_id == current_user.id,
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.end_date > datetime.utcnow()
        )
    )
    subscription = subscription_result.scalar_one_or_none()

    if not subscription:
        return {
            "has_subscription": False,
            "archives": []
        }

    # Отримуємо всі архіви що вийшли після початку підписки
    new_archives_result = await session.execute(
        select(Archive).where(
            Archive.created_at >= subscription.start_date,
            Archive.archive_type == 'premium'  # Тільки преміум архіви
        ).order_by(Archive.created_at.desc())
    )
    new_archives = new_archives_result.scalars().all()

    # Отримуємо вже розблоковані архіви
    unlocked_result = await session.execute(
        select(SubscriptionArchive).where(
            SubscriptionArchive.user_id == current_user.id
        )
    )
    unlocked_archives = unlocked_result.scalars().all()
    unlocked_ids = [ua.archive_id for ua in unlocked_archives]

    # Формуємо відповідь
    archives_data = []
    for archive in new_archives:
        is_unlocked = archive.id in unlocked_ids
        archives_data.append({
            "id": archive.id,
            "code": archive.code,
            "title": archive.title,
            "description": archive.description,
            "created_at": archive.created_at.isoformat() if archive.created_at else None,
            "is_unlocked": is_unlocked,
            "can_unlock": not is_unlocked  # Можна розблокувати якщо ще не розблоковано
        })

    # Також додаємо старі розблоковані архіви (з попередніх підписок)
    if unlocked_ids:
        old_unlocked_result = await session.execute(
            select(Archive).where(
                Archive.id.in_(unlocked_ids),
                Archive.created_at < subscription.start_date
            )
        )
        old_archives = old_unlocked_result.scalars().all()

        for archive in old_archives:
            archives_data.append({
                "id": archive.id,
                "code": archive.code,
                "title": archive.title,
                "description": archive.description,
                "created_at": archive.created_at.isoformat() if archive.created_at else None,
                "is_unlocked": True,
                "can_unlock": False,
                "from_previous_subscription": True
            })

    return {
        "has_subscription": True,
        "subscription_end": subscription.end_date.isoformat(),
        "total_archives": len(archives_data),
        "unlocked_count": len(unlocked_ids),
        "archives": archives_data
    }


@router.post("/unlock-archive/{archive_id}")
async def unlock_archive(
        archive_id: int,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Розблокувати архів по підписці"""

    # Перевіряємо підписку
    subscription_result = await session.execute(
        select(Subscription).where(
            Subscription.user_id == current_user.id,
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.end_date > datetime.utcnow()
        )
    )
    subscription = subscription_result.scalar_one_or_none()

    if not subscription:
        raise HTTPException(status_code=403, detail="No active subscription")

    # Перевіряємо архів
    archive_result = await session.execute(
        select(Archive).where(Archive.id == archive_id)
    )
    archive = archive_result.scalar_one_or_none()

    if not archive:
        raise HTTPException(status_code=404, detail="Archive not found")

    # Перевіряємо чи архів вийшов після початку підписки
    if archive.created_at < subscription.start_date:
        raise HTTPException(
            status_code=403,
            detail="This archive was released before your subscription. Please purchase it separately."
        )

    # Перевіряємо чи вже розблокований
    existing = await session.execute(
        select(SubscriptionArchive).where(
            SubscriptionArchive.user_id == current_user.id,
            SubscriptionArchive.archive_id == archive_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Archive already unlocked")

    # Розблоковуємо
    unlock = SubscriptionArchive(
        subscription_id=subscription.id,
        archive_id=archive_id,
        user_id=current_user.id
    )
    session.add(unlock)

    # Оновлюємо статистику архіву
    archive.purchase_count += 1

    await session.commit()

    return {
        "success": True,
        "message": "Archive unlocked successfully",
        "archive": {
            "id": archive.id,
            "code": archive.code,
            "title": archive.title
        }
    }


@router.post("/cancel")
async def cancel_subscription(
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Скасувати автопродовження підписки"""

    result = await session.execute(
        select(Subscription).where(
            Subscription.user_id == current_user.id,
            Subscription.status == SubscriptionStatus.ACTIVE
        )
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        raise HTTPException(status_code=404, detail="No active subscription found")

    subscription.auto_renew = False
    subscription.status = SubscriptionStatus.CANCELLED
    subscription.cancelled_at = datetime.utcnow()

    await session.commit()

    return {
        "success": True,
        "message": "Subscription auto-renewal cancelled",
        "active_until": subscription.end_date.isoformat()
    }


@router.get("/check-access/{archive_id}")
async def check_archive_access(
        archive_id: int,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Перевірити чи має користувач доступ до архіву"""

    # Перевіряємо чи куплений
    purchased = await session.execute(
        select(SubscriptionArchive).where(
            SubscriptionArchive.user_id == current_user.id,
            SubscriptionArchive.archive_id == archive_id
        )
    )
    if purchased.scalar_one_or_none():
        return {"has_access": True, "access_type": "subscription"}

    # Перевіряємо чи архів безкоштовний
    archive_result = await session.execute(
        select(Archive).where(Archive.id == archive_id)
    )
    archive = archive_result.scalar_one_or_none()

    if archive and archive.archive_type == 'free':
        return {"has_access": True, "access_type": "free"}

    # Перевіряємо окрему покупку (якщо є в orders)
    # Тут можна додати перевірку покупок

    return {"has_access": False}