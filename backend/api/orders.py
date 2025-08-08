# backend/api/orders.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_session
from models.order import Order, OrderItem
from models.archive import Archive
from config import settings
import uuid
from sqlalchemy import select

router = APIRouter()


@router.post("/create")
async def create_order(data: dict, session: AsyncSession = Depends(get_session)):
    items = data.get("items", [])
    if not items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    total_price = 0
    order_items_to_create = []

    # Важливо: Перераховуємо суму на бекенді, не довіряючи клієнту
    for item_data in items:
        archive_id = item_data.get("id")
        quantity = item_data.get("quantity", 1)

        # Знаходимо товар в БД, щоб отримати його реальну ціну
        result = await session.execute(select(Archive).where(Archive.id == archive_id))
        archive = result.scalar_one_or_none()

        if not archive:
            raise HTTPException(status_code=404, detail=f"Archive with id {archive_id} not found")

        price = archive.price  # Беремо ціну з БД
        total_price += price * quantity
        order_items_to_create.append({"archive_id": archive_id, "quantity": quantity, "price": price})

    # Створюємо новий об'єкт замовлення
    new_order = Order(
        order_id=str(uuid.uuid4()),
        user_id=1,  # Тимчасово для тестування, потім будемо брати реального юзера
        subtotal=total_price,
        total=total_price
    )

    # Імітація оплати в режимі розробки
    if settings.DEV_MODE:
        new_order.status = "completed"  # Вважаємо замовлення одразу оплаченим

    session.add(new_order)
    await session.flush()  # Потрібно, щоб отримати new_order.id для OrderItem

    # Додаємо товари до замовлення
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
