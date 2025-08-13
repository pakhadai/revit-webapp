# backend/api/favorites.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from database import get_session
from models.user import User
from models.favorite import Favorite
from .dependencies import get_current_user_dependency
from typing import List

router = APIRouter()

@router.get("/", response_model=List[int])
async def get_favorites(
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session)
):
    """Отримати список ID вибраних архівів для поточного користувача."""
    result = await session.execute(
        select(Favorite.archive_id).where(Favorite.user_id == current_user.id)
    )
    favorite_ids = result.scalars().all()
    return favorite_ids

@router.post("/{archive_id}")
async def add_favorite(
    archive_id: int,
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session)
):
    """Додати архів у вибране."""
    # Перевірка, чи вже існує
    existing = await session.execute(
        select(Favorite).where(
            Favorite.user_id == current_user.id,
            Favorite.archive_id == archive_id
        )
    )
    if existing.scalar_one_or_none():
        return {"status": "ok", "message": "Already in favorites"}

    new_favorite = Favorite(user_id=current_user.id, archive_id=archive_id)
    session.add(new_favorite)
    await session.commit()
    return {"status": "ok", "message": "Added to favorites"}

@router.delete("/{archive_id}")
async def remove_favorite(
    archive_id: int,
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session)
):
    """Видалити архів з вибраного."""
    stmt = delete(Favorite).where(
        Favorite.user_id == current_user.id,
        Favorite.archive_id == archive_id
    )
    await session.execute(stmt)
    await session.commit()
    return {"status": "ok", "message": "Removed from favorites"}
