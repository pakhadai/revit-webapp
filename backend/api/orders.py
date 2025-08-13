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
from models.notification import Notification
from models.promo_code import PromoCode, DiscountType
from config import settings
from services.telegram import telegram_service
from .auth import get_current_user_dependency
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


@router.post("/create")
async def create_order(
        data: dict,
        session: AsyncSession = Depends(get_session),
        current_user: User = Depends(get_current_user_dependency)
):
    items = data.get("items", [])
    # Виправлення для промокоду
    promo_code_value = data.get("promo_code")
    promo_code_str = promo_code_value.upper().strip() if promo_code_value else None

    if not items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    subtotal = 0
    order_items_to_create = []

    for item_data in items:
        archive = await session.get(Archive, item_data.get("id"))
        if not archive:
            raise HTTPException(status_code=404, detail=f"Archive with id {item_data.get('id')} not found")

        price = archive.price
        if archive.discount_percent > 0:
            price = price * (1 - archive.discount_percent / 100)

        quantity = item_data.get("quantity", 1)
        subtotal += price * quantity
        order_items_to_create.append({"archive_id": archive.id, "quantity": quantity, "price": price})

    discount = 0
    final_total = subtotal
    if promo_code_str:
        result = await session.execute(select(PromoCode).where(PromoCode.code == promo_code_str))
        promo_code = result.scalar_one_or_none()
        if promo_code and promo_code.is_valid():
            if promo_code.discount_type == DiscountType.PERCENTAGE:
                discount = subtotal * (promo_code.value / 100)
            elif promo_code.discount_type == DiscountType.FIXED_AMOUNT:
                discount = promo_code.value

            final_total = max(0, subtotal - discount)
            promo_code.current_uses += 1
        else:
            promo_code_str = None

    new_order = Order(
        order_id=str(uuid.uuid4()),
        user_id=current_user.id,
        subtotal=round(subtotal, 2),
        discount=round(discount, 2),
        total=round(final_total, 2),
        promo_code=promo_code_str
    )
    session.add(new_order)
    await session.flush()

    for item in order_items_to_create:
        order_item = OrderItem(order_id=new_order.id, **item)
        session.add(order_item)
        archive = await session.get(Archive, item["archive_id"])
        if archive:
            notification = Notification(
                user_id=current_user.id,
                message=f"Будь ласка, оцініть ваш новий архів: {archive.title.get('ua', 'архів')}",
                type="rate_reminder",
                related_archive_id=item["archive_id"]
            )
            session.add(notification)

    if settings.DEV_MODE:
        new_order.status = "completed"
        new_order.completed_at = datetime.now(timezone.utc)
        await update_vip_status_after_purchase(current_user.id, new_order, session)
        await grant_user_access_to_purchased_items(new_order.id, current_user.id, session)

    await session.commit()

    if new_order.status == "completed":
        try:
            await telegram_service.send_order_notification(
                user_id=current_user.user_id,
                order_id=new_order.order_id[:8],
                total=final_total,  # ВИПРАВЛЕНО
                lang=current_user.language_code
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to send Telegram notification: {str(e)}")

    return {
        "success": True,
        "order_id": new_order.order_id,
        "total": final_total,  # ВИПРАВЛЕНО
        "status": new_order.status,
    }