# backend/api/admin.py - ДІАГНОСТИЧНА ВЕРСІЯ

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_session
from models import Order, OrderItem
from models.user import User
from models.archive import Archive
from .dependencies import get_current_user_dependency
from datetime import datetime, timedelta, timezone
import logging
import traceback  # <-- Важливий імпорт для діагностики

logger = logging.getLogger(__name__)

router = APIRouter()


def admin_required(current_user: User = Depends(get_current_user_dependency)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user


@router.get("/archives")
async def get_archives_admin(
        session: AsyncSession = Depends(get_session),
        admin_user: User = Depends(admin_required)
):
    """Отримати список всіх архівів для адмін-панелі"""

    try:
        result = await session.execute(
            select(Archive).order_by(Archive.created_at.desc())
        )
        archives = result.scalars().all()

        # Формуємо відповідь
        response_data = []
        for archive in archives:
            # Безпечне отримання першого зображення
            image_path = None
            if archive.image_paths:
                if isinstance(archive.image_paths, list) and len(archive.image_paths) > 0:
                    image_path = archive.image_paths[0]
                elif isinstance(archive.image_paths, str):
                    image_path = archive.image_paths

            if not image_path:
                image_path = "images/icons/icon-192x192.png"

            response_data.append({
                "id": archive.id,
                "code": archive.code,
                "title": archive.title if archive.title else {},
                "description": archive.description if archive.description else {},
                "price": float(archive.price) if archive.price else 0,
                "discount_percent": archive.discount_percent if archive.discount_percent else 0,
                "archive_type": archive.archive_type,
                "image_path": image_path,  # Одне зображення для картки
                "image_paths": archive.image_paths if archive.image_paths else [],
                "file_path": archive.file_path,
                "file_size": archive.file_size,
                "purchase_count": archive.purchase_count if archive.purchase_count else 0,
                "view_count": archive.view_count if archive.view_count else 0,
                "average_rating": archive.average_rating if hasattr(archive, 'average_rating') else 0,
                "ratings_count": archive.ratings_count if hasattr(archive, 'ratings_count') else 0,
                "created_at": archive.created_at.isoformat() if archive.created_at else None
            })

        return response_data

    except Exception as e:
        logger.error(f"Error loading archives: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dashboard")
async def get_admin_dashboard(
        session: AsyncSession = Depends(get_session),
        admin_user: User = Depends(admin_required)
):
    """Головна статистика для адмін панелі"""

    # Загальна статистика
    total_users = await session.execute(select(func.count(User.id)))
    total_archives = await session.execute(select(func.count(Archive.id)))
    total_orders = await session.execute(select(func.count(Order.id)))

    # Статистика за доходами
    revenue_result = await session.execute(
        select(func.sum(Order.total)).where(Order.status == 'completed')
    )
    total_revenue = revenue_result.scalar_one_or_none() or 0

    # Статистика за останні 30 днів
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

    recent_users = await session.execute(
        select(func.count(User.id)).where(User.created_at >= thirty_days_ago)
    )

    recent_orders = await session.execute(
        select(func.count(Order.id)).where(Order.created_at >= thirty_days_ago)
    )

    recent_revenue = await session.execute(
        select(func.sum(Order.total)).where(
            Order.created_at >= thirty_days_ago,
            Order.status == 'completed'
        )
    )

    # Топ архіви за продажами
    top_archives_result = await session.execute(
        select(Archive.title, Archive.code, func.count(OrderItem.id).label('sales_count'))
        .join(OrderItem, Archive.id == OrderItem.archive_id)
        .group_by(Archive.id, Archive.title, Archive.code)
        .order_by(func.count(OrderItem.id).desc())
        .limit(5)
    )
    top_archives = top_archives_result.all()


    return {
        "total_stats": {
            "users": total_users.scalar_one(),
            "archives": total_archives.scalar_one(),
            "orders": total_orders.scalar_one(),
            "revenue": float(total_revenue)
        },
        "recent_stats": {
            "new_users": recent_users.scalar_one(),
            "new_orders": recent_orders.scalar_one(),
            "revenue": float(recent_revenue.scalar_one_or_none() or 0)
        },
        "top_archives": [
            {
                "title": row.title.get('ua', row.code) if row.title else row.code, # Безпечний доступ
                "code": row.code,
                "sales": row.sales_count
            }
            for row in top_archives
        ]
    }


@router.get("/users")
async def get_users_list(
        page: int = 1,
        limit: int = 20,
        session: AsyncSession = Depends(get_session),
        admin_user: User = Depends(admin_required)
):
    """Список користувачів з пагінацією"""

    offset = (page - 1) * limit

    # Отримуємо користувачів
    users_result = await session.execute(
        select(User)
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(limit)
    )

    users = users_result.scalars().all()

    # Загальна кількість
    total_result = await session.execute(select(func.count(User.id)))
    total = total_result.scalar_one()

    return {
        "users": [
            {
                "id": user.id,
                "user_id": user.user_id,
                "username": user.username,
                "full_name": user.full_name,
                "language_code": user.language_code,
                "role": user.role,
                "is_admin": user.is_admin,
                "bonuses": user.bonuses,
                "created_at": user.created_at.isoformat() if user.created_at else None
            }
            for user in users
        ],
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        }
    }


@router.get("/orders")
async def get_orders_list(
        page: int = 1,
        limit: int = 20,
        status: str = None,
        session: AsyncSession = Depends(get_session),
        admin_user: User = Depends(admin_required)
):
    """Список замовлень з пагінацією та фільтрацією"""

    offset = (page - 1) * limit

    # Базовий запит
    query = select(Order).join(User, Order.user_id == User.id)

    # Фільтр за статусом
    if status:
        query = query.where(Order.status == status)

    # Отримуємо замовлення
    orders_result = await session.execute(
        query.order_by(Order.created_at.desc())
        .offset(offset)
        .limit(limit)
    )

    orders = orders_result.scalars().all()

    # Загальна кількість
    count_query = select(func.count(Order.id))
    if status:
        count_query = count_query.where(Order.status == status)

    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    # Отримуємо деталі замовлень
    orders_data = []
    for order in orders:
        # Отримуємо користувача
        user = await session.get(User, order.user_id)

        # Отримуємо товари замовлення
        items_result = await session.execute(
            select(OrderItem, Archive)
            .join(Archive, OrderItem.archive_id == Archive.id)
            .where(OrderItem.order_id == order.id)
        )

        items = []
        for item, archive in items_result.all():
            items.append({
                "archive_title": archive.title.get('ua', archive.code) if archive.title else archive.code,
                "archive_code": archive.code,
                "quantity": item.quantity,
                "price": float(item.price)
            })

        orders_data.append({
            "id": order.id,
            "order_id": order.order_id,
            "status": order.status,
            "total": float(order.total),
            "subtotal": float(order.subtotal),
            "bonuses_used": order.bonuses_used,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "user": {
                "username": user.username if user else "Unknown",
                "full_name": user.full_name if user else "Unknown"
            },
            "items": items
        })

    return {
        "orders": orders_data,
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        }
    }

@router.post("/archives")
async def create_archive(
        archive_data: dict,
        session: AsyncSession = Depends(get_session),
        admin_user: User = Depends(admin_required)
):
    """Створити новий архів"""
    try:
        # Перевірка, чи існує вже архів з таким кодом
        existing_archive = await session.execute(
            select(Archive).where(Archive.code == archive_data.get('code'))
        )
        if existing_archive.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Архів з кодом '{archive_data.get('code')}' вже існує.")

        new_archive = Archive(
            code=archive_data.get('code'),
            title=archive_data.get('title', {}),
            description=archive_data.get('description', {}),
            price=float(archive_data.get('price', 0)),
            discount_percent=int(archive_data.get('discount_percent', 0)),
            archive_type=archive_data.get('archive_type', 'premium'),
            image_paths=archive_data.get('image_paths', []),
            file_path=archive_data.get('file_path'),
            file_size=archive_data.get('file_size')
        )

        session.add(new_archive)
        await session.commit()
        await session.refresh(new_archive)

        return {
            "success": True,
            "message": "Archive created successfully",
            "archive_id": new_archive.id
        }

    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create: {str(e)}")


@router.put("/archives/{archive_id}")
async def update_archive(
        archive_id: int,
        archive_data: dict,
        session: AsyncSession = Depends(get_session),
        admin_user: User = Depends(admin_required)
):
    """Оновити архів"""

    archive = await session.get(Archive, archive_id)
    if not archive:
        raise HTTPException(status_code=404, detail="Archive not found")

    try:
        # Явно оновлюємо кожне поле
        archive.title = archive_data.get('title', archive.title)
        archive.description = archive_data.get('description', archive.description)
        archive.price = float(archive_data.get('price', archive.price))
        archive.discount_percent = int(archive_data.get('discount_percent', archive.discount_percent))
        archive.archive_type = archive_data.get('archive_type', archive.archive_type)

        # Переприсвоюємо список, щоб база даних помітила зміну
        if 'image_paths' in archive_data:
            archive.image_paths = archive_data['image_paths']

        if 'file_path' in archive_data:
            archive.file_path = archive_data['file_path']

        if 'file_size' in archive_data:
            archive.file_size = archive_data['file_size']

        await session.commit()
        await session.refresh(archive)

        return {
            "success": True,
            "message": "Archive updated successfully"
        }

    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to update archive: {str(e)}")


@router.delete("/archives/{archive_id}")
async def delete_archive(
        archive_id: int,
        session: AsyncSession = Depends(get_session),
        admin_user: User = Depends(admin_required)
):
    """Видалити архів"""

    archive = await session.get(Archive, archive_id)
    if not archive:
        raise HTTPException(status_code=404, detail="Archive not found")

    try:
        await session.delete(archive)
        await session.commit()

        return {
            "success": True,
            "message": "Archive deleted successfully"
        }

    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to delete archive: {str(e)}")