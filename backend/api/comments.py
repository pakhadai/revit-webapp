# backend/api/comments.py
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from database import get_session
from models.user import User
from models.comment import Comment
from models.archive import Archive, ArchivePurchase
from models.subscription import SubscriptionArchive
from models.order import Order, OrderItem
from .auth import get_current_user_dependency
from typing import List, Dict, Optional
from datetime import datetime

router = APIRouter()


# Функція для перевірки доступу до архіву (як у ratings.py)
async def check_archive_access(user_id: int, archive_id: int, session: AsyncSession) -> bool:
    """Перевірка чи користувач має доступ до архіву"""

    # 1. Перевіряємо чи архів безкоштовний
    archive = await session.get(Archive, archive_id)
    if not archive:
        return False
    if archive.archive_type == 'free' or archive.price == 0:
        return True

    # 2. Перевіряємо покупку
    purchase = await session.execute(
        select(ArchivePurchase).where(
            ArchivePurchase.user_id == user_id,
            ArchivePurchase.archive_id == archive_id
        )
    )
    if purchase.scalar_one_or_none():
        return True

    # 4. Перевіряємо підписку через SubscriptionArchive
    subscription = await session.execute(
        select(SubscriptionArchive).where(
            SubscriptionArchive.user_id == user_id,
            SubscriptionArchive.archive_id == archive_id
        )
    )
    if subscription.scalar_one_or_none():
        return True

    # 5. Перевіряємо завершені замовлення
    completed_order = await session.execute(
        select(Order.id)
        .join(OrderItem, Order.id == OrderItem.order_id)
        .where(
            Order.user_id == user_id,
            Order.status == 'completed',
            OrderItem.archive_id == archive_id
        )
    )
    if completed_order.scalar_one_or_none():
        return True

    return False


@router.get("/{archive_id}")
async def get_comments(
        archive_id: int,
        limit: int = 50,
        offset: int = 0,
        session: AsyncSession = Depends(get_session)
):
    """Отримати коментарі для архіву"""

    # Перевіряємо чи архів існує
    archive = await session.get(Archive, archive_id)
    if not archive:
        raise HTTPException(status_code=404, detail="Archive not found")

    # Отримуємо коментарі з інформацією про користувачів
    comments_result = await session.execute(
        select(Comment, User)
        .join(User, Comment.user_id == User.id)
        .where(
            Comment.archive_id == archive_id,
            Comment.is_deleted == False,
            Comment.parent_id.is_(None)  # Тільки основні коментарі
        )
        .order_by(Comment.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    comments_data = []
    for comment, user in comments_result.all():
        # Отримуємо відповіді на коментар
        replies_result = await session.execute(
            select(Comment, User)
            .join(User, Comment.user_id == User.id)
            .where(
                Comment.parent_id == comment.id,
                Comment.is_deleted == False
            )
            .order_by(Comment.created_at.asc())
        )

        replies = []
        for reply, reply_user in replies_result.all():
            replies.append({
                "id": reply.id,
                "text": reply.text,
                "user": {
                    "id": reply_user.id,
                    "username": reply_user.username,
                    "full_name": reply_user.full_name
                },
                "is_edited": reply.is_edited,
                "created_at": reply.created_at.isoformat() if reply.created_at else None,
                "updated_at": reply.updated_at.isoformat() if reply.updated_at else None
            })

        comments_data.append({
            "id": comment.id,
            "text": comment.text,
            "user": {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name
            },
            "is_edited": comment.is_edited,
            "created_at": comment.created_at.isoformat() if comment.created_at else None,
            "updated_at": comment.updated_at.isoformat() if comment.updated_at else None,
            "replies": replies
        })

    # Загальна кількість коментарів
    total_result = await session.execute(
        select(func.count(Comment.id))
        .where(
            Comment.archive_id == archive_id,
            Comment.is_deleted == False
        )
    )
    total = total_result.scalar_one()

    return {
        "comments": comments_data,
        "total": total,
        "archive": {
            "id": archive.id,
            "code": archive.code,
            "title": archive.title
        }
    }


@router.post("/{archive_id}")
async def add_comment(
        archive_id: int,
        payload: Dict = Body(...),
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Додати коментар до архіву"""

    text = payload.get("text", "").strip()
    parent_id = payload.get("parent_id")

    if not text or len(text) < 3:
        raise HTTPException(status_code=422, detail="Comment must be at least 3 characters long")

    if len(text) > 500:
        raise HTTPException(status_code=422, detail="Comment must be less than 500 characters")

    # Перевіряємо доступ
    has_access = await check_archive_access(current_user.id, archive_id, session)
    if not has_access:
        raise HTTPException(status_code=403, detail="You can only comment on archives you have access to")

    # Якщо це відповідь, перевіряємо батьківський коментар
    if parent_id:
        parent_result = await session.execute(
            select(Comment).where(
                Comment.id == parent_id,
                Comment.archive_id == archive_id,
                Comment.is_deleted == False
            )
        )
        parent = parent_result.scalar_one_or_none()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent comment not found")
        if parent.parent_id is not None:
            raise HTTPException(status_code=400, detail="Cannot reply to a reply")

    # Створюємо коментар
    new_comment = Comment(
        archive_id=archive_id,
        user_id=current_user.id,
        text=text,
        parent_id=parent_id
    )

    session.add(new_comment)
    await session.commit()
    await session.refresh(new_comment)

    return {
        "success": True,
        "comment": {
            "id": new_comment.id,
            "text": new_comment.text,
            "user": {
                "id": current_user.id,
                "username": current_user.username,
                "full_name": current_user.full_name
            },
            "created_at": new_comment.created_at.isoformat() if new_comment.created_at else None
        }
    }


@router.put("/{comment_id}")
async def edit_comment(
        comment_id: int,
        payload: Dict = Body(...),
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Редагувати власний коментар"""

    text = payload.get("text", "").strip()

    if not text or len(text) < 3:
        raise HTTPException(status_code=422, detail="Comment must be at least 3 characters long")

    # Знаходимо коментар
    comment = await session.get(Comment, comment_id)
    if not comment or comment.is_deleted:
        raise HTTPException(status_code=404, detail="Comment not found")

    # Перевіряємо що це коментар користувача
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own comments")

    # Оновлюємо
    comment.text = text
    comment.is_edited = True

    await session.commit()

    return {
        "success": True,
        "message": "Comment updated successfully"
    }


@router.delete("/{comment_id}")
async def delete_comment(
        comment_id: int,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Видалити власний коментар (м'яке видалення)"""

    # Знаходимо коментар
    comment = await session.get(Comment, comment_id)
    if not comment or comment.is_deleted:
        raise HTTPException(status_code=404, detail="Comment not found")

    # Перевіряємо що це коментар користувача або користувач - адмін
    if comment.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="You can only delete your own comments")

    # М'яке видалення
    comment.is_deleted = True
    comment.text = "[Коментар видалено]"

    await session.commit()

    return {
        "success": True,
        "message": "Comment deleted successfully"
    }


@router.get("/user/my-comments")
async def get_my_comments(
        limit: int = 20,
        offset: int = 0,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Отримати коментарі поточного користувача"""

    comments_result = await session.execute(
        select(Comment, Archive)
        .join(Archive, Comment.archive_id == Archive.id)
        .where(
            Comment.user_id == current_user.id,
            Comment.is_deleted == False
        )
        .order_by(Comment.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    comments_data = []
    for comment, archive in comments_result.all():
        comments_data.append({
            "id": comment.id,
            "text": comment.text,
            "archive": {
                "id": archive.id,
                "code": archive.code,
                "title": archive.title
            },
            "is_edited": comment.is_edited,
            "created_at": comment.created_at.isoformat() if comment.created_at else None
        })

    return {
        "comments": comments_data
    }