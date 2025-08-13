# backend/api/archives.py - ВИПРАВЛЕНА ВЕРСІЯ З УНІВЕРСАЛЬНИМ ПОШУКОМ

from fastapi import APIRouter, Depends, HTTPException, Query, Request
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
    image_paths: List[str]

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
        sort_by: Optional[str] = Query("id", description="Поле для сортування: price, title, created_at"),
        sort_order: Optional[str] = Query("asc", description="Напрямок сортування: asc або desc"),
        session: AsyncSession = Depends(get_session)
):
    """
    Повертає список архівів з можливістю пошуку та фільтрації.
    """
    query = select(Archive)

    # Ваш код для пошуку та фільтрації залишається без змін
    if search:
        search_term = f"%{search.lower()}%"
        query = query.where(or_(
            func.lower(Archive.code).like(search_term),
            func.lower(func.json_extract(Archive.title, '$.ua')).like(search_term),
            func.lower(func.json_extract(Archive.title, '$.en')).like(search_term),
            func.lower(func.json_extract(Archive.description, '$.ua')).like(search_term),
            func.lower(func.json_extract(Archive.description, '$.en')).like(search_term)
        ))
    if archive_type:
        query = query.where(Archive.archive_type == archive_type)
    if min_price is not None:
        query = query.where(Archive.price >= min_price)
    if max_price is not None:
        query = query.where(Archive.price <= max_price)

    order_column = Archive.id
    if sort_by == "price":
        order_column = Archive.price
    elif sort_by == "title":
        order_column = func.json_extract(Archive.title, '$.ua')
    elif sort_by == "created_at":
        order_column = Archive.created_at

    if sort_order == "desc":
        query = query.order_by(order_column.desc())
    else:
        query = query.order_by(order_column.asc())

    result = await session.execute(query)
    archives = result.scalars().all()

    # --- ОСЬ ТУТ ВИПРАВЛЕННЯ ---

    # Формуємо базову URL-адресу сервера
    base_url = str(request.base_url)
    if "ngrok.io" in base_url and base_url.startswith("http://"):
        base_url = base_url.replace("http://", "https://")

    response_archives = []
    for archive in archives:
        # Перевіряємо, чи є у архіву зображення
        if archive.image_paths and isinstance(archive.image_paths, list) and archive.image_paths[0]:
            # Створюємо повну, абсолютну URL-адресу
            image_url = f"{base_url}static/{archive.image_paths[0]}"
        else:
            # Якщо зображення немає, створюємо повну URL для запасного зображення
            image_url = f"{base_url}static/images/placeholder.png"

        response_archives.append(ArchiveOut(
            id=archive.id,
            code=archive.code,
            title=archive.title or {},
            description=archive.description or {},
            price=archive.price,
            discount_percent=archive.discount_percent,
            archive_type=archive.archive_type,
            # Модель очікує список, тому повертаємо URL у списку
            image_paths=[image_url]
        ))

    return {
        "items": response_archives,
        "page": page,
        "has_more": len(response_archives) >= 12,
        "total": len(response_archives)
    }