# backend/api/archives.py - ВИПРАВЛЕНА версія
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func
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

    # Пошук по назві та коду
    if search:
        search_filter = or_(
            Archive.code.ilike(f"%{search}%"),
            Archive.title["ua"].as_string().ilike(f"%{search}%"),
            Archive.title["en"].as_string().ilike(f"%{search}%"),
            Archive.description["ua"].as_string().ilike(f"%{search}%"),
            Archive.description["en"].as_string().ilike(f"%{search}%")
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
    if sort_by == "price":
        order_column = Archive.price
    elif sort_by == "title":
        order_column = Archive.title["ua"].as_string()
    elif sort_by == "created_at":
        order_column = Archive.created_at
    else:
        order_column = Archive.id

    if sort_order == "desc":
        query = query.order_by(order_column.desc())
    else:
        query = query.order_by(order_column.asc())

    result = await session.execute(query)
    archives = result.scalars().all()

    # Форматуємо відповідь
    response_data = []
    for archive in archives:
        response_data.append({
            "id": archive.id,
            "code": archive.code,
            "title": archive.title if isinstance(archive.title, dict) else {},
            "description": archive.description if isinstance(archive.description, dict) else {},
            "price": archive.price,
            "discount_percent": archive.discount_percent,
            "archive_type": archive.archive_type,
            "image_path": archive.image_path or "/images/placeholder.png"
        })

    return response_data


@router.get("/{archive_id}", response_model=ArchiveOut)
async def get_archive_details(archive_id: int, session: AsyncSession = Depends(get_session)):
    """
    Повертає деталі архіву з БАЗИ ДАНИХ.
    """
    result = await session.execute(select(Archive).where(Archive.id == archive_id))
    archive = result.scalar_one_or_none()
    if not archive:
        raise HTTPException(status_code=404, detail="Archive not found")

    return {
        "id": archive.id,
        "code": archive.code,
        "title": archive.title if isinstance(archive.title, dict) else {},
        "description": archive.description if isinstance(archive.description, dict) else {},
        "price": archive.price,
        "discount_percent": archive.discount_percent,
        "archive_type": archive.archive_type,
        "image_path": archive.image_path or "/images/placeholder.png"
    }


# ДОДАЄМО НОВИЙ ЕНДПОІНТ для пагінації (опціонально)
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

    query = select(Archive)

    # Застосовуємо фільтри
    if search:
        search_filter = or_(
            Archive.code.ilike(f"%{search}%"),
            Archive.title["ua"].as_string().ilike(f"%{search}%"),
            Archive.title["en"].as_string().ilike(f"%{search}%")
        )
        query = query.where(search_filter)

    if archive_type:
        query = query.where(Archive.archive_type == archive_type)

    if min_price is not None:
        query = query.where(Archive.price >= min_price)
    if max_price is not None:
        query = query.where(Archive.price <= max_price)

    # Сортування
    if sort_by == "price":
        order_column = Archive.price
    elif sort_by == "title":
        order_column = Archive.title["ua"].as_string()
    elif sort_by == "created_at":
        order_column = Archive.created_at
    else:
        order_column = Archive.id

    if sort_order == "desc":
        query = query.order_by(order_column.desc())
    else:
        query = query.order_by(order_column.asc())

    # Рахуємо загальну кількість
    count_result = await session.execute(select(func.count(Archive.id)))
    total_count = count_result.scalar_one()

    # Застосовуємо пагінацію
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    result = await session.execute(query)
    archives = result.scalars().all()

    # Форматуємо відповідь
    items = []
    for archive in archives:
        items.append({
            "id": archive.id,
            "code": archive.code,
            "title": archive.title if isinstance(archive.title, dict) else {},
            "description": archive.description if isinstance(archive.description, dict) else {},
            "price": archive.price,
            "discount_percent": archive.discount_percent,
            "archive_type": archive.archive_type,
            "image_path": archive.image_path or "/images/placeholder.png"
        })

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit,
        "has_more": page * limit < total_count
    }
