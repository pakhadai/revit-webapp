# backend/api/ratings.py

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from database import get_session
from models.user import User
from models.archive import Archive, ArchivePurchase
from models.subscription import SubscriptionArchive
from models.archive_rating import ArchiveRating
from models.order import Order, OrderItem  # <-- ДОДАНО ІМПОРТИ
from .auth import get_current_user_dependency
from typing import List, Dict

router = APIRouter()


# Функція для перевірки доступу до архіву
async def check_archive_access(user_id: int, archive_id: int, session: AsyncSession) -> bool:
    # 1. Перевіряємо, чи архів безкоштовний
    archive = await session.get(Archive, archive_id)
    if not archive:
        raise HTTPException(status_code=404, detail="Archive not found")
    if archive.archive_type == 'free':
        return True

    # 2. Перевіряємо, чи був він куплений (запис в ArchivePurchase)
    purchase = await session.execute(
        select(ArchivePurchase).where(ArchivePurchase.user_id == user_id, ArchivePurchase.archive_id == archive_id))
    if purchase.scalar_one_or_none():
        return True

    # 3. Перевіряємо, чи був він розблокований по підписці
    subscription = await session.execute(select(SubscriptionArchive).where(SubscriptionArchive.user_id == user_id,
                                                                           SubscriptionArchive.archive_id == archive_id))
    if subscription.scalar_one_or_none():
        return True

    # 4. ВИПРАВЛЕННЯ: Перевіряємо, чи є у користувача завершене замовлення з цим товаром
    completed_order = await session.execute(
        select(Order.id)
        .join(OrderItem, Order.id == OrderItem.order_id)
        .where(
            Order.user_id == user_id,
            Order.status == 'completed',
            OrderItem.archive_id == archive_id
        )
    )
    if completed_order.scalar_one_or_none():
        return True

    return False


# Функція для перерахунку середнього рейтингу
async def recalculate_average_rating(archive_id: int, session: AsyncSession):
    result = await session.execute(
        select(func.avg(ArchiveRating.rating), func.count(ArchiveRating.id))
        .where(ArchiveRating.archive_id == archive_id)
    )
    avg_rating, count = result.one()

    archive = await session.get(Archive, archive_id)
    if archive:
        archive.average_rating = round(avg_rating, 2) if avg_rating else 0
        archive.ratings_count = count
        await session.commit()


@router.post("/{archive_id}")
async def submit_rating(
        archive_id: int,
        payload: Dict = Body(...),
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    rating_value = payload.get("rating_value")
    if not isinstance(rating_value, int) or not (1 <= rating_value <= 5):
        raise HTTPException(status_code=422, detail="Rating must be an integer between 1 and 5.")

    has_access = await check_archive_access(current_user.id, archive_id, session)
    if not has_access:
        raise HTTPException(status_code=403, detail="You can only rate archives you have access to.")

    stmt = sqlite_insert(ArchiveRating).values(
        user_id=current_user.id,
        archive_id=archive_id,
        rating=rating_value
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=['user_id', 'archive_id'],
        set_={'rating': rating_value}
    )
    await session.execute(stmt)
    await session.commit()

    await recalculate_average_rating(archive_id, session)

    return {"status": "ok", "message": "Rating submitted successfully"}


@router.get("/my-ratings", response_model=Dict[int, int])
async def get_my_ratings(
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    result = await session.execute(
        select(ArchiveRating.archive_id, ArchiveRating.rating).where(ArchiveRating.user_id == current_user.id)
    )
    return {archive_id: rating for archive_id, rating in result.all()}