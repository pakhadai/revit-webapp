# backend/api/promo_codes.py
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from database import get_session
from models.user import User
from models.promo_code import PromoCode, DiscountType
from models.order import Order
from .dependencies import get_current_user_dependency
from .dependencies import admin_required
from typing import List, Optional, Dict
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel

router = APIRouter()


# Pydantic моделі для валідації
class PromoCodeCreate(BaseModel):
    code: str
    discount_type: str  # "percentage" або "fixed_amount"
    value: float
    expires_at: Optional[datetime] = None
    max_uses: Optional[int] = None
    min_purchase_amount: Optional[float] = 0
    is_active: bool = True


class PromoCodeUpdate(BaseModel):
    is_active: Optional[bool] = None
    max_uses: Optional[int] = None
    expires_at: Optional[datetime] = None


class PromoCodeResponse(BaseModel):
    id: int
    code: str
    discount_type: str
    value: float
    expires_at: Optional[datetime]
    max_uses: Optional[int]
    current_uses: int
    is_active: bool
    min_purchase_amount: float
    created_at: datetime


# --- Ендпоінти для адміністрування промокодів ---

@router.post("/", dependencies=[Depends(admin_required)])
async def create_promo_code(
        data: Dict,
        session: AsyncSession = Depends(get_session)
):
    """Створити новий промокод"""
    try:
        # Перевіряємо чи не існує вже такий код
        existing = await session.execute(
            select(PromoCode).where(PromoCode.code == data.get("code", "").upper())
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Промокод з таким кодом вже існує")

        # Визначаємо тип знижки
        discount_type = DiscountType.PERCENTAGE if data.get(
            "discount_type") == "percentage" else DiscountType.FIXED_AMOUNT

        new_code = PromoCode(
            code=data.get("code", "").upper().strip(),
            discount_type=discount_type,
            value=float(data.get("value", 0)),
            expires_at=datetime.fromisoformat(data.get("expires_at")) if data.get("expires_at") else None,
            max_uses=data.get("max_uses"),
            min_purchase_amount=float(data.get("min_purchase_amount", 0)),
            is_active=data.get("is_active", True)
        )

        session.add(new_code)
        await session.commit()
        await session.refresh(new_code)

        return {
            "success": True,
            "message": "Промокод створено успішно",
            "promo_code": {
                "id": new_code.id,
                "code": new_code.code,
                "discount_type": new_code.discount_type.value,
                "value": new_code.value
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Невірний формат даних: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка створення промокоду: {str(e)}")


@router.get("/")
async def get_promo_codes(
        admin_check: User = Depends(admin_required),
        session: AsyncSession = Depends(get_session)
):
    """Отримати список всіх промокодів (тільки для адміна)"""
    try:
        result = await session.execute(
            select(PromoCode).order_by(desc(PromoCode.created_at))
        )
        codes = result.scalars().all()

        return [
            {
                "id": code.id,
                "code": code.code,
                "discount_type": code.discount_type.value,
                "value": code.value,
                "expires_at": code.expires_at.isoformat() if code.expires_at else None,
                "max_uses": code.max_uses,
                "current_uses": code.current_uses,
                "is_active": code.is_active,
                "min_purchase_amount": code.min_purchase_amount,
                "created_at": code.created_at.isoformat() if code.created_at else None
            }
            for code in codes
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка завантаження промокодів: {str(e)}")


@router.get("/check/{code}")
async def check_promo_code(
        code: str,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Перевірити промокод (для користувачів)"""
    code_upper = code.upper().strip()

    result = await session.execute(
        select(PromoCode).where(PromoCode.code == code_upper)
    )
    promo_code = result.scalar_one_or_none()

    if not promo_code:
        raise HTTPException(status_code=404, detail="Промокод не знайдено")

    if not promo_code.is_active:
        raise HTTPException(status_code=400, detail="Промокод неактивний")

    if promo_code.expires_at and promo_code.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Термін дії промокоду закінчився")

    if promo_code.max_uses and promo_code.current_uses >= promo_code.max_uses:
        raise HTTPException(status_code=400, detail="Досягнуто ліміт використання промокоду")

    # Перевіряємо чи не використовував вже цей користувач цей промокод
    user_orders = await session.execute(
        select(Order).where(
            Order.user_id == current_user.id,
            Order.promo_code == code_upper,
            Order.status.in_(["completed", "pending"])
        )
    )
    if user_orders.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ви вже використовували цей промокод")

    return {
        "valid": True,
        "code": promo_code.code,
        "discount_type": promo_code.discount_type.value,
        "value": promo_code.value,
        "min_purchase_amount": promo_code.min_purchase_amount,
        "message": f"Промокод дійсний! Знижка: {promo_code.value}{'%' if promo_code.discount_type == DiscountType.PERCENTAGE else ' USD'}"
    }


@router.put("/{code_id}")
async def update_promo_code(
        code_id: int,
        data: Dict,
        admin_check: User = Depends(admin_required),
        session: AsyncSession = Depends(get_session)
):
    """Оновити промокод (тільки для адміна)"""
    code = await session.get(PromoCode, code_id)
    if not code:
        raise HTTPException(status_code=404, detail="Промокод не знайдено")

    # Оновлюємо тільки передані поля
    if "is_active" in data:
        code.is_active = bool(data["is_active"])

    if "max_uses" in data:
        code.max_uses = data["max_uses"]

    if "expires_at" in data:
        if data["expires_at"]:
            code.expires_at = datetime.fromisoformat(data["expires_at"])
        else:
            code.expires_at = None

    if "value" in data:
        code.value = float(data["value"])

    await session.commit()

    return {
        "success": True,
        "message": "Промокод оновлено",
        "updated_fields": list(data.keys())
    }


@router.delete("/{code_id}")
async def delete_promo_code(
        code_id: int,
        admin_check: User = Depends(admin_required),
        session: AsyncSession = Depends(get_session)
):
    """Видалити промокод (тільки для адміна)"""
    code = await session.get(PromoCode, code_id)
    if not code:
        raise HTTPException(status_code=404, detail="Промокод не знайдено")

    await session.delete(code)
    await session.commit()

    return {
        "success": True,
        "message": f"Промокод {code.code} видалено"
    }


@router.get("/stats")
async def get_promo_stats(
        admin_check: User = Depends(admin_required),
        session: AsyncSession = Depends(get_session)
):
    """Отримати статистику використання промокодів"""
    result = await session.execute(select(PromoCode))
    codes = result.scalars().all()

    total_codes = len(codes)
    active_codes = sum(1 for c in codes if c.is_active)
    total_uses = sum(c.current_uses for c in codes)

    # Підрахунок загальної знижки
    orders_with_promo = await session.execute(
        select(Order).where(Order.promo_code.isnot(None))
    )
    total_discount = sum(order.discount for order in orders_with_promo.scalars().all())

    return {
        "total_codes": total_codes,
        "active_codes": active_codes,
        "total_uses": total_uses,
        "total_discount_given": round(total_discount, 2),
        "most_used": [
            {
                "code": c.code,
                "uses": c.current_uses,
                "discount_given": round(c.value * c.current_uses if c.discount_type == DiscountType.FIXED_AMOUNT else 0,
                                        2)
            }
            for c in sorted(codes, key=lambda x: x.current_uses, reverse=True)[:5]
        ]
    }