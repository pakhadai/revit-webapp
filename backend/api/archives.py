# backend/api/archives.py - ВИПРАВЛЕНА ВЕРСІЯ З УНІВЕРСАЛЬНИМ ПОШУКОМ

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, text
from typing import List, Dict, Any, Optional
from database import get_session
from models.archive import Archive
from pydantic import BaseModel

router = APIRouter()

class ArchiveOut(BaseModel):
    id: int
    code: str
    title: Dict[str, str]
    description: Dict[str, str]
    price: float
    discount_percent: int
    archive_type: str
    image_paths: List[str] # Змінено з image_path на image_paths

    class Config:
        from_attributes = True


@router.get("/paginated/list")
async def get_archives_list(
        search: Optional[str] = Query(None, description="Пошуковий запит"),
        archive_type: Optional[str] = Query(None, description="Тип архіву: premium або free"),
        min_price: Optional[float] = Query(None, description="Мінімальна ціна"),
        max_price: Optional[float] = Query(None, description="Максимальна ціна"),
        sort_by: Optional[str] = Query("id", description="Поле для сортування: price, title, created_at"),
        sort_order: Optional[str] = Query("asc", description="Напрямок сортування: asc або desc"),
        session: AsyncSession = Depends(get_session)
):
    """
    Повертає список архівів з можливістю пошуку та фільтрації.
    """
    query = select(Archive)

    # ✅ ВИПРАВЛЕНИЙ ПОШУК ДЛЯ SQLITE
    if search:
        search_term = f"%{search.lower()}%"
        query = query.where(or_(
            func.lower(Archive.code).like(search_term),
            func.lower(func.json_extract(Archive.title, '$.ua')).like(search_term),
            func.lower(func.json_extract(Archive.title, '$.en')).like(search_term),
            func.lower(func.json_extract(Archive.description, '$.ua')).like(search_term),
            func.lower(func.json_extract(Archive.description, '$.en')).like(search_term)
        ))

    # Фільтр за типом
    if archive_type:
        query = query.where(Archive.archive_type == archive_type)

    # Фільтр за ціною
    if min_price is not None:
        query = query.where(Archive.price >= min_price)
    if max_price is not None:
        query = query.where(Archive.price <= max_price)

    # Сортування
    order_column = Archive.id  # Default
    if sort_by == "price":
        order_column = Archive.price
    elif sort_by == "title":
        # ✅ ВИПРАВЛЕНЕ СОРТУВАННЯ ДЛЯ SQLITE
        order_column = func.json_extract(Archive.title, '$.ua')
    elif sort_by == "created_at":
        order_column = Archive.created_at

    if sort_order == "desc":
        query = query.order_by(order_column.desc())
    else:
        query = query.order_by(order_column.asc())

    result = await session.execute(query)
    archives = result.scalars().all()

    # ✅ Перетворюємо результат у відповідність до моделі Pydantic
    response_archives = []
    for archive in archives:
        image_to_display = (archive.image_paths[0] if isinstance(archive.image_paths, list) and archive.image_paths else "/images/placeholder.png")
        response_archives.append(ArchiveOut(
            id=archive.id,
            code=archive.code,
            title=archive.title or {},
            description=archive.description or {},
            price=archive.price,
            discount_percent=archive.discount_percent,
            archive_type=archive.archive_type,
            image_paths=[image_to_display] # Повертаємо список, як очікує модель
        ))

    return response_archives