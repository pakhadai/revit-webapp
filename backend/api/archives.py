# backend/api/archives.py - ВИПРАВЛЕНА ВЕРСІЯ

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from typing import List, Dict, Any, Optional
from database import get_session
from models.archive import Archive
from pydantic import BaseModel

from config import settings

router = APIRouter()


class ArchiveOut(BaseModel):
    id: int
    code: str
    title: Dict[str, str]
    description: Dict[str, str]
    price: float
    discount_percent: int
    archive_type: str
    image_paths: List[str]
    average_rating: float = 0
    ratings_count: int = 0

    class Config:
        from_attributes = True


@router.get("/paginated/list")
async def get_archives_list(
        request: Request,
        page: int = 1,
        search: Optional[str] = Query(None, description="Пошуковий запит"),
        archive_type: Optional[str] = Query(None, description="Тип архіву: premium або free"),
        min_price: Optional[float] = Query(None, description="Мінімальна ціна"),
        max_price: Optional[float] = Query(None, description="Максимальна ціна"),
        sort_by: Optional[str] = Query("created_at", description="Поле для сортування: price, title, created_at"),
        sort_order: Optional[str] = Query("desc", description="Напрямок сортування: asc або desc"),
        session: AsyncSession = Depends(get_session)
):
    """
    Повертає список архівів з можливістю пошуку та фільтрації.
    """
    limit = 12
    offset = (page - 1) * limit

    # Базові запити
    query = select(Archive)
    count_query = select(func.count(Archive.id))

    # Фільтрація
    filters = []
    if search:
        search_term = f"%{search.lower()}%"
        filters.append(or_(
            func.lower(Archive.code).like(search_term),
            func.lower(func.json_extract(Archive.title, '$.ua')).like(search_term),
            func.lower(func.json_extract(Archive.title, '$.en')).like(search_term)
        ))
    if archive_type:
        filters.append(Archive.archive_type == archive_type)
    if min_price is not None:
        filters.append(Archive.price >= min_price)
    if max_price is not None:
        filters.append(Archive.price <= max_price)

    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)

    # Загальна кількість
    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    # Сортування
    order_column_map = {
        "price": Archive.price,
        "title": func.json_extract(Archive.title, '$.ua'),
        "created_at": Archive.created_at,
        "id": Archive.id
    }
    order_column = order_column_map.get(sort_by, Archive.created_at)

    if sort_order == "desc":
        query = query.order_by(order_column.desc())
    else:
        query = query.order_by(order_column.asc())

    # Виконання запиту з пагінацією
    result = await session.execute(query.offset(offset).limit(limit))
    archives = result.scalars().all()

    # --- ОСНОВНЕ ВИПРАВЛЛЕННЯ ТУТ ---
    base_url = settings.APP_URL.rstrip('/')  # Використовуємо APP_URL з конфігу
    response_archives = []

    for archive in archives:
        # Створюємо повні шляхи до зображень
        full_image_paths = []
        if archive.image_paths and isinstance(archive.image_paths, list):
            for path in archive.image_paths:
                if path and not path.startswith(('http://', 'https://')):
                    full_image_paths.append(f"{base_url}/{path}")  # Додаємо повний шлях
                elif path:
                    full_image_paths.append(path)

        # Створюємо об'єкт для відповіді і перезаписуємо шляхи
        archive_out = ArchiveOut.from_orm(archive)
        archive_out.image_paths = full_image_paths if full_image_paths else [f"{base_url}/media/images/placeholder.png"]
        response_archives.append(archive_out)

    return {
        "items": response_archives,
        "page": page,
        "has_more": (offset + len(archives)) < total,
        "total": total
    }