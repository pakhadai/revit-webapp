# backend/api/admin.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from database import get_session
from models.user import User
from models.archive import Archive
from models.order import Order, OrderItem
from .auth import get_current_user_dependency
from typing import Dict, List
from datetime import datetime, timedelta

router = APIRouter()


# Декоратор для перевірки прав адміністратора
def admin_required(current_user: User = Depends(get_current_user_dependency)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user


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
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

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
    top_archives = await session.execute(
        select(Archive.title, Archive.code, func.count(OrderItem.id).label('sales_count'))
        .join(OrderItem, Archive.id == OrderItem.archive_id)
        .group_by(Archive.id, Archive.title, Archive.code)
        .order_by(func.count(OrderItem.id).desc())
        .limit(5)
    )

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
                "title": row.title,
                "code": row.code,
                "sales": row.sales_count
            }
            for row in top_archives.all()
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
        user_result = await session.execute(
            select(User).where(User.id == order.user_id)
        )
        user = user_result.scalar_one_or_none()

        # Отримуємо товари замовлення
        items_result = await session.execute(
            select(OrderItem, Archive)
            .join(Archive, OrderItem.archive_id == Archive.id)
            .where(OrderItem.order_id == order.id)
        )

        items = []
        for item, archive in items_result.all():
            items.append({
                "archive_title": archive.title,
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


@router.get("/archives")
async def get_archives_admin(
        session: AsyncSession = Depends(get_session),
        admin_user: User = Depends(admin_required)
):
    """Список архівів для адміністрування"""

    result = await session.execute(
        select(Archive).order_by(Archive.created_at.desc())
    )
    archives = result.scalars().all()

    return [
        {
            "id": archive.id,
            "code": archive.code,
            "title": archive.title,
            "description": archive.description,
            "price": float(archive.price),
            "discount_percent": archive.discount_percent,
            "archive_type": archive.archive_type,
            "image_path": archive.image_path,
            "purchase_count": archive.purchase_count,
            "view_count": archive.view_count,
            "created_at": archive.created_at.isoformat() if archive.created_at else None
        }
        for archive in archives
    ]


@router.post("/archives")
async def create_archive(
        archive_data: dict,
        session: AsyncSession = Depends(get_session),
        admin_user: User = Depends(admin_required)
):
    """Створити новий архів"""
    try:
        # Підтримка нового формату зображень
        image_paths = archive_data.get('image_paths', [])
        if not image_paths and archive_data.get('image_path'):
            image_paths = [archive_data.get('image_path')]

        new_archive = Archive(
            code=archive_data.get('code'),
            title=archive_data.get('title', {}),
            description=archive_data.get('description', {}),
            price=float(archive_data.get('price', 0)),
            discount_percent=int(archive_data.get('discount_percent', 0)),
            archive_type=archive_data.get('archive_type', 'premium'),
            image_path=archive_data.get('image_path', ''),  # Для сумісності
            image_paths=image_paths,  # Новий формат
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
        raise HTTPException(status_code=400, detail=f"Failed to create: {str(e)}")


@router.put("/archives/{archive_id}")
async def update_archive(
        archive_id: int,
        archive_data: dict,
        session: AsyncSession = Depends(get_session),
        admin_user: User = Depends(admin_required)
):
    """Оновити архів"""

    result = await session.execute(
        select(Archive).where(Archive.id == archive_id)
    )
    archive = result.scalar_one_or_none()

    if not archive:
        raise HTTPException(status_code=404, detail="Archive not found")

    try:
        # Оновлюємо поля
        if 'title' in archive_data:
            archive.title = archive_data['title']
        if 'description' in archive_data:
            archive.description = archive_data['description']
        if 'price' in archive_data:
            archive.price = float(archive_data['price'])
        if 'discount_percent' in archive_data:
            archive.discount_percent = int(archive_data['discount_percent'])
        if 'archive_type' in archive_data:
            archive.archive_type = archive_data['archive_type']
        if 'image_path' in archive_data:
            archive.image_path = archive_data['image_path']
        if 'image_paths' in archive_data:
            archive.image_paths = archive_data['image_paths']
        if 'file_path' in archive_data:
            archive.file_path = archive_data['file_path']
        if 'file_size' in archive_data:
            archive.file_size = archive_data['file_size']

        await session.commit()

        return {
            "success": True,
            "message": "Archive updated successfully"
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to update archive: {str(e)}")


@router.delete("/archives/{archive_id}")
async def delete_archive(
        archive_id: int,
        session: AsyncSession = Depends(get_session),
        admin_user: User = Depends(admin_required)
):
    """Видалити архів"""

    result = await session.execute(
        select(Archive).where(Archive.id == archive_id)
    )
    archive = result.scalar_one_or_none()

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
        raise HTTPException(status_code=400, detail=f"Failed to delete archive: {str(e)}")