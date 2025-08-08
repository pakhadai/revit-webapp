# backend/api/archives.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any

from database import get_session
from models.archive import Archive
from pydantic import BaseModel

router = APIRouter()


# ВИПРАВЛЕНА Pydantic модель для відповіді
class ArchiveOut(BaseModel):
    id: int
    code: str
    title: Dict[str, str]  # Змінено з Json на Dict[str, str]
    description: Dict[str, str]  # Змінено з Json на Dict[str, str]
    price: float
    discount_percent: int
    archive_type: str
    image_path: str

    class Config:
        from_attributes = True


@router.get("/", response_model=List[ArchiveOut])
async def get_archives_list(session: AsyncSession = Depends(get_session)):
    """
    Повертає список всіх архівів з БАЗИ ДАНИХ.
    """
    result = await session.execute(select(Archive))
    archives = result.scalars().all()

    # Для кожного архіву переконуємося, що поля title і description правильно серіалізовані
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