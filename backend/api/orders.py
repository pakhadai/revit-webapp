# backend/api/orders.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_session
from models.order import Order, OrderItem
from models.archive import Archive
from models.user import User
from config import settings
import uuid
from sqlalchemy import select
from .auth import get_current_user # <--- Імпортуємо залежність

router = APIRouter()


@router.post("/create")
async def create_order(
    data: dict,
    session: AsyncSession = Depends(get_session),
    # Захищаємо ендпоінт та отримуємо поточного користувача
    current_user: User = Depends(get_current_user)
):
    items = data.get("items", [])
    if not items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    total_price = 0
    order_items_to_create = []

    for item_data in items:
        archive_id = item_data.get("id")
        quantity = item_data.get("quantity", 1)

        result = await session.execute(select(Archive).where(Archive.id == archive_id))
        archive = result.scalar_one_or_none()

        if not archive:
            raise HTTPException(status_code=404, detail=f"Archive with id {archive_id} not found")

        price = archive.price
        total_price += price * quantity
        order_items_to_create.append({"archive_id": archive_id, "quantity": quantity, "price": price})

    new_order = Order(
        order_id=str(uuid.uuid4()),
        # Використовуємо ID реального користувача
        user_id=current_user.id,
        subtotal=total_price,
        total=total_price
    )

    if settings.DEV_MODE:
        new_order.status = "completed"

    session.add(new_order)
    await session.flush()

    for item in order_items_to_create:
        order_item = OrderItem(
            order_id=new_order.id,
            archive_id=item["archive_id"],
            quantity=item["quantity"],
            price=item["price"]
        )
        session.add(order_item)

    await session.commit()

    return {
        "success": True,
        "order_id": new_order.order_id,
        "detail": "Order created successfully (Simulated Payment)"
    }