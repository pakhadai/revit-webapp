# backend/api/orders.py - З ВИПРАВЛЕННЯМ ДОСТУПУ
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_session
from models.order import Order, OrderItem
from models.archive import Archive, ArchivePurchase  # <-- Додаємо ArchivePurchase
from models.user import User
from models.notification import Notification  # <-- Додаємо Notification
from config import settings
import uuid
from sqlalchemy import select
from datetime import datetime

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
            select(ArchivePurchase).where(ArchivePurchase.user_id == user_id, ArchivePurchase.archive_id == archive_id)
        )
        if not existing_purchase.scalar_one_or_none():
            new_purchase = ArchivePurchase(user_id=user_id, archive_id=archive_id,
                                           price_paid=0)  # price_paid тут не критичний
            session.add(new_purchase)

    await session.commit()


@router.post("/create")
async def create_order(
        data: dict,
        session: AsyncSession = Depends(get_session),
        current_user: User = Depends(get_current_user_dependency)
):
    items = data.get("items", [])
    if not items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    total_price = 0
    order_items_to_create = []

    for item_data in items:
        archive = await session.get(Archive, item_data.get("id"))
        if not archive:
            raise HTTPException(status_code=404, detail=f"Archive with id {item_data.get('id')} not found")

        price = archive.price
        quantity = item_data.get("quantity", 1)
        total_price += price * quantity
        order_items_to_create.append({"archive_id": archive.id, "quantity": quantity, "price": price})

    new_order = Order(
        order_id=str(uuid.uuid4()),
        user_id=current_user.id,
        subtotal=total_price,
        total=total_price
    )

    session.add(new_order)
    await session.flush()

    for item in order_items_to_create:
        order_item = OrderItem(order_id=new_order.id, **item)
        session.add(order_item)

        # Створюємо повідомлення з проханням оцінити товар
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
        new_order.completed_at = datetime.utcnow()
        await update_vip_status_after_purchase(current_user.id, new_order, session)
        # ВИПРАВЛЕННЯ: Надаємо доступ до товарів одразу після "оплати" в dev-режимі
        await grant_user_access_to_purchased_items(new_order.id, current_user.id, session)

    await session.commit()

    return {
        "success": True,
        "order_id": new_order.order_id,
        "total": total_price,
        "status": new_order.status,
    }