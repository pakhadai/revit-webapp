# backend/api/orders.py - ОНОВЛЕНА ВЕРСІЯ
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone, timedelta
import uuid

from database import get_session
from models.archive import Archive, ArchivePurchase
from models.order import Order, OrderItem
from models.user import User
from models.bonus import BonusTransaction, BonusTransactionType
from models.notification import Notification
from models.promo_code import PromoCode, DiscountType
from config import settings
from services.telegram import telegram_service
from .dependencies import get_current_user_dependency
from .vip_processing import update_vip_status_after_purchase

router = APIRouter()


async def grant_user_access_to_purchased_items(order_id: int, user_id: int, session: AsyncSession):
    """Надає користувачу доступ до куплених товарів, створюючи записи в ArchivePurchase."""
    items_result = await session.execute(
        select(OrderItem.archive_id).where(OrderItem.order_id == order_id)
    )
    archive_ids = items_result.scalars().all()

    for archive_id in archive_ids:
        # Перевіряємо, чи вже існує такий запис, щоб уникнути дублікатів
        existing_purchase = await session.execute(
            select(ArchivePurchase).where(
                ArchivePurchase.user_id == user_id,
                ArchivePurchase.archive_id == archive_id
            )
        )
        if not existing_purchase.scalar_one_or_none():
            new_purchase = ArchivePurchase(
                user_id=user_id,
                archive_id=archive_id,
                price_paid=0  # price_paid тут не критичний
            )
            session.add(new_purchase)

    await session.commit()


@router.post("/apply-promo")
async def apply_promo_code(data: dict, session: AsyncSession = Depends(get_session)):
    code_str = data.get("code", "").upper().strip()
    subtotal = float(data.get("subtotal", 0))

    if not code_str:
        raise HTTPException(status_code=400, detail="Promo code is required")

    result = await session.execute(select(PromoCode).where(PromoCode.code == code_str))
    promo_code = result.scalar_one_or_none()

    if not promo_code or not promo_code.is_active:
        raise HTTPException(status_code=404, detail="Invalid promo code")
    if promo_code.expires_at and promo_code.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Promo code has expired")
    if promo_code.max_uses is not None and promo_code.current_uses >= promo_code.max_uses:
        raise HTTPException(status_code=400, detail="Promo code has reached its usage limit")

    discount = 0
    if promo_code.discount_type == DiscountType.PERCENTAGE:
        discount = subtotal * (promo_code.value / 100)
    elif promo_code.discount_type == DiscountType.FIXED_AMOUNT:
        discount = promo_code.value

    final_total = max(0, subtotal - discount)

    return {
        "success": True,
        "discount_amount": round(discount, 2),
        "final_total": round(final_total, 2),
        "message": f"Знижку {promo_code.value}{'%' if promo_code.discount_type == DiscountType.PERCENTAGE else ' USD'} застосовано!"
    }


# backend/api/orders.py - ДОДАЙТЕ ЦЮ ФУНКЦІЮ

async def validate_bonus_payment(subtotal: float, bonuses_to_use: int, user_bonuses: int) -> dict:
    """
    Валідація оплати бонусами з дотриманням ліміту 70%

    Returns:
        dict з полями:
        - valid: bool
        - max_allowed_bonuses: int
        - error_message: str (якщо не valid)
    """
    # Конвертуємо USD в бонуси (100 бонусів = $1)
    total_in_bonuses = int(subtotal * settings.BONUSES_PER_USD)

    # Максимум 70% можна оплатити бонусами
    max_allowed_bonuses = int(total_in_bonuses * settings.BONUS_PURCHASE_CAP)

    # Перевірка 1: Чи не перевищує ліміт 70%
    if bonuses_to_use > max_allowed_bonuses:
        return {
            "valid": False,
            "max_allowed_bonuses": max_allowed_bonuses,
            "error_message": f"Максимум {settings.BONUS_PURCHASE_CAP * 100:.0f}% можна оплатити бонусами. Максимально дозволено: {max_allowed_bonuses} бонусів"
        }

    # Перевірка 2: Чи достатньо бонусів у користувача
    if bonuses_to_use > user_bonuses:
        return {
            "valid": False,
            "max_allowed_bonuses": max_allowed_bonuses,
            "error_message": f"Недостатньо бонусів. У вас є: {user_bonuses}"
        }

    # Перевірка 3: Чи не від'ємна сума
    if bonuses_to_use < 0:
        return {
            "valid": False,
            "max_allowed_bonuses": max_allowed_bonuses,
            "error_message": "Кількість бонусів не може бути від'ємною"
        }

    return {
        "valid": True,
        "max_allowed_bonuses": max_allowed_bonuses,
        "error_message": None
    }


# ОНОВЛЕНИЙ ENDPOINT для створення замовлення з валідацією
@router.post("/create")
async def create_order(
        data: dict,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Створити нове замовлення З ВАЛІДАЦІЄЮ БОНУСІВ"""

    items = data.get("items", [])
    promo_code = data.get("promo_code")
    bonuses_to_use = int(data.get("bonuses", 0))

    if not items:
        raise HTTPException(status_code=400, detail="Корзина порожня")

    # Рахуємо загальну суму
    subtotal = 0
    order_items = []

    for item in items:
        result = await session.execute(
            select(Archive).where(Archive.id == item["id"])
        )
        archive = result.scalar_one_or_none()

        if not archive:
            raise HTTPException(
                status_code=404,
                detail=f"Архів з ID {item['id']} не знайдено"
            )

        subtotal += archive.price
        order_items.append({
            "archive": archive,
            "quantity": 1,
            "price": archive.price
        })

    # Застосовуємо промокод якщо є
    discount = 0
    if promo_code:
        # Тут логіка промокоду (вже є у вас)
        pass

    # ВАЖЛИВО: Валідація бонусів
    if bonuses_to_use > 0:
        validation = await validate_bonus_payment(
            subtotal=subtotal - discount,  # Враховуємо знижку від промокоду
            bonuses_to_use=bonuses_to_use,
            user_bonuses=current_user.bonuses
        )

        if not validation["valid"]:
            raise HTTPException(
                status_code=400,
                detail=validation["error_message"]
            )

        # Якщо користувач намагається використати більше дозволеного,
        # автоматично обмежуємо до максимуму
        if bonuses_to_use > validation["max_allowed_bonuses"]:
            bonuses_to_use = validation["max_allowed_bonuses"]

    # Обчислюємо фінальну суму
    bonuses_discount = bonuses_to_use / settings.BONUSES_PER_USD
    total = max(0, subtotal - discount - bonuses_discount)

    # Створюємо замовлення
    order = Order(
        order_id=f"ORD-{uuid.uuid4().hex[:8].upper()}",
        user_id=current_user.id,
        status="pending" if total > 0 else "completed",
        subtotal=subtotal,
        discount=discount,
        bonuses_used=bonuses_to_use,
        total=total,
        promo_code=promo_code.upper() if promo_code else None
    )

    session.add(order)
    await session.flush()

    # Додаємо товари до замовлення
    for item_data in order_items:
        order_item = OrderItem(
            order_id=order.id,
            archive_id=item_data["archive"].id,
            quantity=item_data["quantity"],
            price=item_data["price"]
        )
        session.add(order_item)

    # Якщо оплата повністю бонусами (total = 0)
    if total == 0:
        # Списуємо бонуси
        current_user.bonuses -= bonuses_to_use
        current_user.total_bonuses_spent += bonuses_to_use

        # Записуємо транзакцію
        transaction = BonusTransaction(
            user_id=current_user.id,
            amount=-bonuses_to_use,
            balance_after=current_user.bonuses,
            type=BonusTransactionType.PURCHASE_PAYMENT,
            description=f"Оплата замовлення #{order.order_id}",
            order_id=order.id
        )
        session.add(transaction)

        # Надаємо доступ до архівів
        await grant_user_access_to_purchased_items(order.id, current_user.id, session)

        # Оновлюємо VIP статус
        await update_vip_status_after_purchase(current_user.id, order.subtotal, session)

        order.status = "completed"
        order.completed_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(order)

    return {
        "success": True,
        "order_id": order.order_id,
        "total": order.total,
        "bonuses_used": order.bonuses_used,
        "payment_required": order.total > 0,
        "max_bonuses_allowed": validation["max_allowed_bonuses"] if bonuses_to_use > 0 else None
    }


# ENDPOINT для перевірки максимально дозволених бонусів
@router.post("/check-bonus-limit")
async def check_bonus_limit(
        data: dict,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Перевірити скільки максимум бонусів можна використати"""

    subtotal = float(data.get("subtotal", 0))

    if subtotal <= 0:
        raise HTTPException(status_code=400, detail="Невірна сума")

    # Обчислюємо максимум бонусів (70% від суми)
    total_in_bonuses = int(subtotal * settings.BONUSES_PER_USD)
    max_allowed_bonuses = int(total_in_bonuses * settings.BONUS_PURCHASE_CAP)

    # Обмежуємо балансом користувача
    available_bonuses = min(max_allowed_bonuses, current_user.bonuses)

    return {
        "user_bonuses": current_user.bonuses,
        "max_allowed_bonuses": max_allowed_bonuses,
        "available_to_use": available_bonuses,
        "percentage_limit": settings.BONUS_PURCHASE_CAP * 100,
        "equivalent_usd": available_bonuses / settings.BONUSES_PER_USD
    }
