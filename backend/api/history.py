# backend/api/history.py

from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, text
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from database import get_session
from models.user import User
from models.archive import Archive
from models.view_history import ViewHistory
from .auth import get_current_user_dependency
from typing import List

router = APIRouter()
MAX_HISTORY_ITEMS = 20


async def cleanup_history(user_id: int, session: AsyncSession):
    """Видаляє старі записи з історії, залишаючи тільки MAX_HISTORY_ITEMS."""
    subquery = select(ViewHistory.id).where(ViewHistory.user_id == user_id).order_by(
        ViewHistory.viewed_at.desc()).offset(MAX_HISTORY_ITEMS).scalar_subquery()
    await session.execute(
        delete(ViewHistory).where(ViewHistory.user_id == user_id, ViewHistory.id.in_(subquery))
    )
    await session.commit()


@router.post("/view/{archive_id}")
async def track_view(
        archive_id: int,
        background_tasks: BackgroundTasks,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Записує перегляд архіву."""
    stmt = sqlite_insert(ViewHistory).values(
        user_id=current_user.id,
        archive_id=archive_id
    )
    # Специфічний синтаксис для SQLite, який оновлює запис при конфлікті
    stmt = stmt.on_conflict_do_update(
        index_elements=['user_id', 'archive_id'],
        set_={'viewed_at': text('CURRENT_TIMESTAMP')}
    )
    await session.execute(stmt)
    await session.commit()

    # Додаємо очистку старих записів у фоновому режимі
    background_tasks.add_task(cleanup_history, user_id=current_user.id, session=session)

    return {"status": "ok"}


@router.get("/recently-viewed")
async def get_recently_viewed(
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Повертає список останніх переглянутих архівів."""
    result = await session.execute(
        select(Archive)
        .join(ViewHistory, Archive.id == ViewHistory.archive_id)
        .where(ViewHistory.user_id == current_user.id)
        .order_by(ViewHistory.viewed_at.desc())
        .limit(MAX_HISTORY_ITEMS)
    )
    archives = result.scalars().all()
    return archives

async def cleanup_history(user_id: int, session: AsyncSession):
    subquery = select(ViewHistory.id).where(ViewHistory.user_id == user_id).order_by(ViewHistory.viewed_at.desc()).offset(MAX_HISTORY_ITEMS).scalar_subquery()
    await session.execute(delete(ViewHistory).where(ViewHistory.user_id == user_id, ViewHistory.id.in_(subquery)))
    await session.commit()

@router.post("/view/{archive_id}")
async def track_view(archive_id: int, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user_dependency), session: AsyncSession = Depends(get_session)):
    stmt = sqlite_insert(ViewHistory).values(user_id=current_user.id, archive_id=archive_id)
    stmt = stmt.on_conflict_do_update(index_elements=['user_id', 'archive_id'], set_={'viewed_at': text('CURRENT_TIMESTAMP')})
    await session.execute(stmt)
    await session.commit()
    background_tasks.add_task(cleanup_history, user_id=current_user.id, session=session)
    return {"status": "ok"}

@router.get("/recently-viewed")
async def get_recently_viewed(current_user: User = Depends(get_current_user_dependency), session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Archive).join(ViewHistory, Archive.id == ViewHistory.archive_id).where(ViewHistory.user_id == current_user.id).order_by(ViewHistory.viewed_at.desc()).limit(MAX_HISTORY_ITEMS))
    return result.scalars().all()

# НОВИЙ ЕНДПОІНТ
@router.delete("/clear")
async def clear_history(
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session)
):
    """Видалити всю історію переглядів для поточного користувача."""
    await session.execute(
        delete(ViewHistory).where(ViewHistory.user_id == current_user.id)
    )
    await session.commit()
    return {"status": "ok", "message": "History cleared"}