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
