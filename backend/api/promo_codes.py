# backend/api/promo_codes.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_session
from models.user import User
from models.promo_code import PromoCode, DiscountType
from .auth import get_current_user_dependency
from .admin import admin_required
from typing import List
from datetime import datetime

router = APIRouter()


# --- Ендпоінти для адміністрування промокодів ---

@router.post("/", dependencies=[Depends(admin_required)])
async def create_promo_code(data: dict, session: AsyncSession = Depends(get_session)):
    new_code = PromoCode(
        code=data.get("code").upper(),
        discount_type=data.get("discount_type"),
        value=data.get("value"),
        expires_at=datetime.fromisoformat(data.get("expires_at")) if data.get("expires_at") else None,
        max_uses=data.get("max_uses")
    )
    session.add(new_code)
    await session.commit()
    return {"success": True, "message": "Promo code created successfully."}


@router.get("/", dependencies=[Depends(admin_required)], response_model=List[dict])
async def get_promo_codes(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(PromoCode).order_by(PromoCode.created_at.desc()))
    codes = result.scalars().all()
    return [{
        "id": c.id, "code": c.code, "discount_type": c.discount_type.value,
        "value": c.value, "expires_at": c.expires_at, "max_uses": c.max_uses,
        "current_uses": c.current_uses, "is_active": c.is_active
    } for c in codes]


@router.put("/{code_id}", dependencies=[Depends(admin_required)])
async def update_promo_code(code_id: int, data: dict, session: AsyncSession = Depends(get_session)):
    code = await session.get(PromoCode, code_id)
    if not code:
        raise HTTPException(status_code=404, detail="Promo code not found")

    code.is_active = data.get("is_active", code.is_active)
    await session.commit()
    return {"success": True, "message": "Promo code updated."}
