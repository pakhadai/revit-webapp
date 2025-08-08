# backend/api/archives.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from database import get_session
from models.archive import Archive
from pydantic import BaseModel, Json

router = APIRouter()

# Створюємо Pydantic модель для відповіді, щоб уникнути помилок
class ArchiveOut(BaseModel):
    id: int
    code: str
    title: Json
    description: Json
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
