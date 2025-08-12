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



@router.post("/", dependencies=[Depends(admin_required)])
async def create_archive(
        data: dict,
        session: AsyncSession = Depends(get_session)
):
    """Створити новий архів"""
    try:
        # Обробка зображень
        image_paths = data.get("image_paths", [])
        if not image_paths and data.get("image_path"):
            # Підтримка старого формату
            image_paths = [data.get("image_path")]

        new_archive = Archive(
            title=data.get("title", {}),
            description=data.get("description", {}),
            price=float(data.get("price", 0)),
            discount_percent=float(data.get("discount_percent", 0)),
            category=data.get("category", "other"),
            is_new=data.get("is_new", False),
            is_popular=data.get("is_popular", False),
            file_count=int(data.get("file_count", 0)),
            total_size=data.get("total_size", "0 MB"),
            software_version=data.get("software_version", ""),
            tags=data.get("tags", []),
            image_paths=image_paths,  # Новий формат
            file_path=data.get("file_path"),  # Шлях до архіву
            file_size=data.get("file_size"),  # Розмір файлу
            download_url=data.get("download_url", "")  # Для сумісності
        )

        session.add(new_archive)
        await session.commit()
        await session.refresh(new_archive)

        return {
            "success": True,
            "archive": {
                "id": new_archive.id,
                "title": new_archive.title
            }
        }
    except Exception as e:
        raise HTTPException(500, f"Помилка створення архіву: {str(e)}")


@router.put("/{archive_id}", dependencies=[Depends(admin_required)])
async def update_archive(
        archive_id: int,
        data: dict,
        session: AsyncSession = Depends(get_session)
):
    """Оновити архів"""
    archive = await session.get(Archive, archive_id)
    if not archive:
        raise HTTPException(404, "Архів не знайдено")

    # Оновлюємо поля
    if "title" in data:
        archive.title = data["title"]
    if "description" in data:
        archive.description = data["description"]
    if "price" in data:
        archive.price = float(data["price"])
    if "discount_percent" in data:
        archive.discount_percent = float(data["discount_percent"])
    if "category" in data:
        archive.category = data["category"]
    if "is_new" in data:
        archive.is_new = bool(data["is_new"])
    if "is_popular" in data:
        archive.is_popular = bool(data["is_popular"])
    if "image_paths" in data:
        archive.image_paths = data["image_paths"]
    if "file_path" in data:
        archive.file_path = data["file_path"]
    if "file_size" in data:
        archive.file_size = data["file_size"]

    await session.commit()

    return {"success": True, "message": "Архів оновлено"}


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