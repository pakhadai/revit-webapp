# backend/api/archives.py - ВИПРАВЛЕНА ВЕРСІЯ З ПРАЦЮЮЧИМ ПОШУКОМ
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
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
    image_path: str

    class Config:
        from_attributes = True


# ОСНОВНИЙ ЕНДПОІНТ - має бути саме "/" а не "/archives"
@router.get("/", response_model=List[ArchiveOut])
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

    # Пошук по назві та коду (ВИПРАВЛЕНО ДЛЯ SQLITE)
    if search:
        search_term = f"%{search.lower()}%"
        search_filter = or_(
            func.lower(Archive.code).like(search_term),
            func.lower(Archive.title.op('->>')('$.ua')).like(search_term),
            func.lower(Archive.title.op('->>')('$.en')).like(search_term),
            func.lower(Archive.description.op('->>')('$.ua')).like(search_term),
            func.lower(Archive.description.op('->>')('$.en')).like(search_term)
        )
        query = query.where(search_filter)

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
        order_column = Archive.title.op('->>')('$.ua')
    elif sort_by == "created_at":
        order_column = Archive.created_at

    if sort_order == "desc":
        query = query.order_by(order_column.desc())
    else:
        query = query.order_by(order_column.asc())

    result = await session.execute(query)
    archives = result.scalars().all()
    return archives


@router.get("/{archive_id}", response_model=ArchiveOut)
async def get_archive_details(archive_id: int, session: AsyncSession = Depends(get_session)):
    """
    Повертає деталі архіву з БАЗИ ДАНИХ.
    """
    result = await session.execute(select(Archive).where(Archive.id == archive_id))
    archive = result.scalar_one_or_none()
    if not archive:
        raise HTTPException(status_code=404, detail="Archive not found")
    return archive


@router.get("/paginated/list")
async def get_archives_paginated(
        page: int = Query(1, ge=1, description="Номер сторінки"),
        limit: int = Query(12, ge=1, le=50, description="Кількість на сторінці"),
        search: Optional[str] = Query(None),
        archive_type: Optional[str] = Query(None),
        min_price: Optional[float] = Query(None),
        max_price: Optional[float] = Query(None),
        sort_by: Optional[str] = Query("id"),
        sort_order: Optional[str] = Query("asc"),
        session: AsyncSession = Depends(get_session)
):
    """Повертає пагінований список архівів"""

    base_query = select(Archive)
    count_query = select(func.count(Archive.id))

    # Застосовуємо фільтри (ВИПРАВЛЕНО ДЛЯ SQLITE)
    if search:
        search_term = f"%{search.lower()}%"
        search_filter = or_(
            func.lower(Archive.code).like(search_term),
            func.lower(Archive.title.op('->>')('$.ua')).like(search_term),
            func.lower(Archive.title.op('->>')('$.en')).like(search_term),
            func.lower(Archive.description.op('->>')('$.ua')).like(search_term),
            func.lower(Archive.description.op('->>')('$.en')).like(search_term)
        )
        base_query = base_query.where(search_filter)
        count_query = count_query.where(search_filter)

    if archive_type:
        base_query = base_query.where(Archive.archive_type == archive_type)
        count_query = count_query.where(Archive.archive_type == archive_type)

    if min_price is not None:
        base_query = base_query.where(Archive.price >= min_price)
        count_query = count_query.where(Archive.price >= min_price)
    if max_price is not None:
        base_query = base_query.where(Archive.price <= max_price)
        count_query = count_query.where(Archive.price <= max_price)

    # Рахуємо загальну кількість ВІДФІЛЬТРОВАНИХ результатів
    total_result = await session.execute(count_query)
    total_count = total_result.scalar_one()

    # Сортування
    order_column = Archive.id  # Default
    if sort_by == "price":
        order_column = Archive.price
    elif sort_by == "title":
        # Сортуємо по українській назві
        order_column = Archive.title.op('->>')('$.ua')
    elif sort_by == "created_at":
        order_column = Archive.created_at

    if sort_order == "desc":
        base_query = base_query.order_by(order_column.desc())
    else:
        base_query = base_query.order_by(order_column.asc())

    # Застосовуємо пагінацію
    offset = (page - 1) * limit
    final_query = base_query.offset(offset).limit(limit)

    result = await session.execute(final_query)
    archives = result.scalars().all()

    return {
        "items": archives,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit,
        "has_more": page * limit < total_count
    }