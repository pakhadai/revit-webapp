# backend/api/marketplace.py
"""
API для маркетплейсу розробників
Створіть цей новий файл в папці backend/api/
"""

from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_, or_, func
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
import logging

from database import get_session
from models.user import User
from models.archive import Archive
from models.marketplace import (
    DeveloperStatus, ProductStatus, TransactionType,
    DeveloperApplication, DeveloperProfile, MarketplaceProduct,
    MarketplaceTransaction, DeveloperWithdrawal, ProductReview
)
from api.dependencies import get_current_user_dependency, admin_required
from config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


# ===== PYDANTIC МОДЕЛІ =====

class DeveloperApplicationCreate(BaseModel):
    """Створення заявки на статус розробника"""
    company_name: Optional[str] = Field(None, max_length=200)
    portfolio_url: Optional[str] = Field(None, max_length=500)
    description: str = Field(..., min_length=100, max_length=2000)
    specialization: List[str]
    contact_email: str
    contact_phone: Optional[str] = None
    contact_telegram: Optional[str] = None
    accepted_terms: bool


class MarketplaceProductCreate(BaseModel):
    """Створення товару в маркетплейсі"""
    code: str
    title: Dict[str, str]
    description: Dict[str, str]
    price: float = Field(..., gt=0)
    category: str
    tags: List[str]
    version: str = "1.0.0"
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None


class ProductReviewCreate(BaseModel):
    """Створення відгуку"""
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = Field(None, max_length=200)
    comment: Optional[str] = Field(None, max_length=1000)


class WithdrawalRequest(BaseModel):
    """Запит на виплату"""
    amount: float = Field(..., gt=0)
    payment_method: str = Field(..., pattern="^(crypto|bank|paypal)$") # ВИПРАВЛЕНО ТУТ
    payment_details: Dict


# ===== ЗАЯВКИ НА СТАТУС РОЗРОБНИКА =====

@router.post("/apply")
async def apply_as_developer(
        application: DeveloperApplicationCreate,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Подати заявку на статус розробника"""

    # Перевіряємо чи вже є заявка
    existing = await session.execute(
        select(DeveloperApplication).where(
            DeveloperApplication.user_id == current_user.id,
            DeveloperApplication.status.in_([
                DeveloperStatus.PENDING,
                DeveloperStatus.APPROVED
            ])
        )
    )

    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="You already have an active or pending application"
        )

    # Створюємо заявку
    new_application = DeveloperApplication(
        user_id=current_user.id,
        **application.dict()
    )

    session.add(new_application)
    await session.commit()

    return {
        "success": True,
        "message": "Application submitted successfully",
        "application_id": new_application.id
    }


@router.get("/application/status")
async def get_application_status(
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Отримати статус заявки"""

    result = await session.execute(
        select(DeveloperApplication).where(
            DeveloperApplication.user_id == current_user.id
        ).order_by(DeveloperApplication.submitted_at.desc())
    )

    application = result.scalar_one_or_none()

    if not application:
        return {"status": "none"}

    return {
        "status": application.status.value,
        "submitted_at": application.submitted_at,
        "reviewed_at": application.reviewed_at,
        "rejection_reason": application.rejection_reason
    }


# ===== АДМІНІСТРУВАННЯ ЗАЯВОК =====

@router.get("/admin/applications")
async def get_pending_applications(
        status: Optional[str] = Query(None),
        admin_user: User = Depends(admin_required),
        session: AsyncSession = Depends(get_session)
):
    """Отримати список заявок (для адміна)"""

    query = select(DeveloperApplication)

    if status:
        query = query.where(DeveloperApplication.status == DeveloperStatus(status))

    result = await session.execute(
        query.order_by(DeveloperApplication.submitted_at.desc())
    )

    applications = result.scalars().all()

    return [{
        "id": app.id,
        "user_id": app.user_id,
        "company_name": app.company_name,
        "specialization": app.specialization,
        "status": app.status.value,
        "submitted_at": app.submitted_at
    } for app in applications]


@router.put("/admin/applications/{application_id}/approve")
async def approve_application(
        application_id: int,
        commission_rate: float = Query(0.30, ge=0, le=1),
        admin_user: User = Depends(admin_required),
        session: AsyncSession = Depends(get_session)
):
    """Схвалити заявку"""

    application = await session.get(DeveloperApplication, application_id)

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Оновлюємо заявку
    application.status = DeveloperStatus.APPROVED
    application.reviewed_at = datetime.utcnow()
    application.reviewed_by = admin_user.id
    application.commission_rate = commission_rate

    # Створюємо профіль розробника
    developer_profile = DeveloperProfile(
        user_id=application.user_id,
        display_name=application.company_name or f"Developer_{application.user_id}",
        slug=f"dev_{application.user_id}",
        commission_rate=commission_rate,
        specializations=application.specialization
    )

    session.add(developer_profile)

    # Оновлюємо роль користувача
    user = await session.get(User, application.user_id)
    if user:
        user.role = "developer"

    await session.commit()

    return {
        "success": True,
        "message": "Application approved",
        "developer_id": developer_profile.id
    }


@router.put("/admin/applications/{application_id}/reject")
async def reject_application(
        application_id: int,
        reason: str,
        admin_user: User = Depends(admin_required),
        session: AsyncSession = Depends(get_session)
):
    """Відхилити заявку"""

    application = await session.get(DeveloperApplication, application_id)

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    application.status = DeveloperStatus.REJECTED
    application.reviewed_at = datetime.utcnow()
    application.reviewed_by = admin_user.id
    application.rejection_reason = reason

    await session.commit()

    return {"success": True, "message": "Application rejected"}


# ===== ПРОФІЛЬ РОЗРОБНИКА =====

@router.get("/profile")
async def get_developer_profile(
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Отримати свій профіль розробника"""

    result = await session.execute(
        select(DeveloperProfile).where(
            DeveloperProfile.user_id == current_user.id
        )
    )

    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(
            status_code=404,
            detail="Developer profile not found"
        )

    return {
        "id": profile.id,
        "display_name": profile.display_name,
        "slug": profile.slug,
        "bio": profile.bio,
        "specializations": profile.specializations,
        "total_products": profile.total_products,
        "total_sales": profile.total_sales,
        "average_rating": profile.average_rating,
        "balance": profile.balance,
        "commission_rate": profile.commission_rate,
        "is_verified": profile.is_verified
    }


@router.put("/profile")
async def update_developer_profile(
        updates: Dict,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Оновити профіль розробника"""

    result = await session.execute(
        select(DeveloperProfile).where(
            DeveloperProfile.user_id == current_user.id
        )
    )

    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Оновлюємо дозволені поля
    allowed_fields = [
        "display_name", "bio", "website", "social_links",
        "skills", "avatar_url", "banner_url"
    ]

    for field, value in updates.items():
        if field in allowed_fields and hasattr(profile, field):
            setattr(profile, field, value)

    profile.updated_at = datetime.utcnow()

    await session.commit()

    return {"success": True, "message": "Profile updated"}


# ===== ТОВАРИ МАРКЕТПЛЕЙСУ =====

@router.post("/products")
async def create_marketplace_product(
        product_data: MarketplaceProductCreate,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Створити товар в маркетплейсі"""

    # Перевіряємо профіль розробника
    dev_result = await session.execute(
        select(DeveloperProfile).where(
            DeveloperProfile.user_id == current_user.id
        )
    )

    developer = dev_result.scalar_one_or_none()

    if not developer:
        raise HTTPException(
            status_code=403,
            detail="Developer profile required"
        )

    # Створюємо архів
    archive = Archive(
        code=f"MP_{product_data.code}",
        title=product_data.title,
        description=product_data.description,
        price=product_data.price,
        archive_type="marketplace",
        tags=product_data.tags
    )

    session.add(archive)
    await session.flush()

    # Створюємо товар маркетплейсу
    marketplace_product = MarketplaceProduct(
        archive_id=archive.id,
        developer_id=developer.id,
        status=ProductStatus.DRAFT,
        version=product_data.version,
        meta_title=product_data.meta_title,
        meta_description=product_data.meta_description
    )

    session.add(marketplace_product)

    # Оновлюємо статистику розробника
    developer.total_products += 1

    await session.commit()

    return {
        "success": True,
        "product_id": marketplace_product.id,
        "archive_id": archive.id
    }


@router.get("/products")
async def get_developer_products(
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Отримати свої товари"""

    # Знаходимо профіль розробника
    dev_result = await session.execute(
        select(DeveloperProfile).where(
            DeveloperProfile.user_id == current_user.id
        )
    )

    developer = dev_result.scalar_one_or_none()

    if not developer:
        raise HTTPException(status_code=403, detail="Developer profile required")

    # Отримуємо товари
    result = await session.execute(
        select(MarketplaceProduct, Archive).join(Archive).where(
            MarketplaceProduct.developer_id == developer.id
        ).order_by(MarketplaceProduct.last_updated.desc())
    )

    products = result.all()

    return [{
        "id": product.id,
        "archive_id": archive.id,
        "code": archive.code,
        "title": archive.title,
        "price": archive.price,
        "status": product.status.value,
        "view_count": product.view_count,
        "sale_count": product.sale_count,
        "revenue": product.revenue,
        "version": product.version,
        "last_updated": product.last_updated
    } for product, archive in products]


@router.post("/products/{product_id}/submit")
async def submit_for_review(
        product_id: int,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Відправити товар на модерацію"""

    # Перевіряємо власника
    result = await session.execute(
        select(MarketplaceProduct).join(DeveloperProfile).where(
            MarketplaceProduct.id == product_id,
            DeveloperProfile.user_id == current_user.id
        )
    )

    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if product.status not in [ProductStatus.DRAFT, ProductStatus.REJECTED]:
        raise HTTPException(
            status_code=400,
            detail="Product cannot be submitted in current status"
        )

    product.status = ProductStatus.PENDING_REVIEW
    product.submitted_at = datetime.utcnow()

    await session.commit()

    return {"success": True, "message": "Product submitted for review"}


# ===== МОДЕРАЦІЯ ТОВАРІВ =====

@router.get("/admin/products/pending")
async def get_pending_products(
        admin_user: User = Depends(admin_required),
        session: AsyncSession = Depends(get_session)
):
    """Отримати товари на модерації"""

    result = await session.execute(
        select(MarketplaceProduct, Archive, DeveloperProfile).join(
            Archive
        ).join(
            DeveloperProfile
        ).where(
            MarketplaceProduct.status == ProductStatus.PENDING_REVIEW
        ).order_by(MarketplaceProduct.submitted_at)
    )

    products = result.all()

    return [{
        "id": product.id,
        "title": archive.title,
        "price": archive.price,
        "developer": developer.display_name,
        "submitted_at": product.submitted_at,
        "version": product.version
    } for product, archive, developer in products]


@router.put("/admin/products/{product_id}/approve")
async def approve_product(
        product_id: int,
        notes: Optional[str] = None,
        admin_user: User = Depends(admin_required),
        session: AsyncSession = Depends(get_session)
):
    """Схвалити товар"""

    product = await session.get(MarketplaceProduct, product_id)

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.status = ProductStatus.APPROVED
    product.reviewed_at = datetime.utcnow()
    product.reviewed_by = admin_user.id
    product.review_notes = notes

    # Оновлюємо архів
    archive = await session.get(Archive, product.archive_id)
    if archive:
        archive.is_active = True

    await session.commit()

    return {"success": True, "message": "Product approved"}


@router.put("/admin/products/{product_id}/reject")
async def reject_product(
        product_id: int,
        reason: str,
        admin_user: User = Depends(admin_required),
        session: AsyncSession = Depends(get_session)
):
    """Відхилити товар"""

    product = await session.get(MarketplaceProduct, product_id)

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.status = ProductStatus.REJECTED
    product.reviewed_at = datetime.utcnow()
    product.reviewed_by = admin_user.id
    product.rejection_reason = reason

    await session.commit()

    return {"success": True, "message": "Product rejected"}


# ===== ФІНАНСИ ТА ТРАНЗАКЦІЇ =====

@router.get("/balance")
async def get_developer_balance(
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Отримати баланс розробника"""

    result = await session.execute(
        select(DeveloperProfile).where(
            DeveloperProfile.user_id == current_user.id
        )
    )

    developer = result.scalar_one_or_none()

    if not developer:
        raise HTTPException(status_code=404, detail="Developer profile not found")

    # Отримуємо останні транзакції
    trans_result = await session.execute(
        select(MarketplaceTransaction).where(
            MarketplaceTransaction.developer_id == developer.id
        ).order_by(MarketplaceTransaction.created_at.desc()).limit(10)
    )

    transactions = trans_result.scalars().all()

    return {
        "balance": developer.balance,
        "total_earned": developer.total_earned,
        "total_withdrawn": developer.total_withdrawn,
        "commission_rate": developer.commission_rate,
        "recent_transactions": [{
            "id": t.id,
            "type": t.type.value,
            "amount": t.amount,
            "developer_amount": t.developer_amount,
            "description": t.description,
            "created_at": t.created_at
        } for t in transactions]
    }


@router.post("/withdraw")
async def request_withdrawal(
        request: WithdrawalRequest,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Запит на виплату коштів"""

    result = await session.execute(
        select(DeveloperProfile).where(
            DeveloperProfile.user_id == current_user.id
        )
    )

    developer = result.scalar_one_or_none()

    if not developer:
        raise HTTPException(status_code=404, detail="Developer profile not found")

    # Перевіряємо баланс
    if request.amount > developer.balance:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # Мінімальна сума для виплати
    MIN_WITHDRAWAL = 50.0
    if request.amount < MIN_WITHDRAWAL:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum withdrawal amount is ${MIN_WITHDRAWAL}"
        )

    # Створюємо запит на виплату
    withdrawal = DeveloperWithdrawal(
        developer_id=developer.id,
        amount=request.amount,
        payment_method=request.payment_method,
        payment_details=request.payment_details
    )

    session.add(withdrawal)

    # Оновлюємо баланс (резервуємо кошти)
    developer.balance -= request.amount

    await session.commit()

    return {
        "success": True,
        "message": "Withdrawal request submitted",
        "withdrawal_id": withdrawal.id
    }


# ===== ВІДГУКИ ТА РЕЙТИНГИ =====

@router.post("/products/{product_id}/reviews")
async def create_product_review(
        product_id: int,
        review: ProductReviewCreate,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Створити відгук на товар"""

    # Перевіряємо чи купував користувач цей товар
    purchase_result = await session.execute(
        select(MarketplaceTransaction).where(
            MarketplaceTransaction.product_id == product_id,
            MarketplaceTransaction.user_id == current_user.id,
            MarketplaceTransaction.type == TransactionType.SALE
        )
    )

    purchase = purchase_result.scalar_one_or_none()

    if not purchase:
        raise HTTPException(
            status_code=403,
            detail="You must purchase this product to leave a review"
        )

    # Перевіряємо чи вже є відгук
    existing_result = await session.execute(
        select(ProductReview).where(
            ProductReview.product_id == product_id,
            ProductReview.user_id == current_user.id
        )
    )

    if existing_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already reviewed this product")

    # Створюємо відгук
    new_review = ProductReview(
        product_id=product_id,
        user_id=current_user.id,
        rating=review.rating,
        title=review.title,
        comment=review.comment,
        is_verified_purchase=True
    )

    session.add(new_review)

    # Оновлюємо рейтинг товару
    rating_result = await session.execute(
        select(
            func.avg(ProductReview.rating),
            func.count(ProductReview.id)
        ).where(ProductReview.product_id == product_id)
    )

    avg_rating, count = rating_result.one()

    product = await session.get(MarketplaceProduct, product_id)
    if product:
        archive = await session.get(Archive, product.archive_id)
        if archive:
            archive.average_rating = float(avg_rating or 0)
            archive.ratings_count = count

    await session.commit()

    return {
        "success": True,
        "message": "Review created successfully",
        "review_id": new_review.id
    }


@router.get("/products/{product_id}/reviews")
async def get_product_reviews(
        product_id: int,
        page: int = Query(1, ge=1),
        session: AsyncSession = Depends(get_session)
):
    """Отримати відгуки на товар"""

    limit = 10
    offset = (page - 1) * limit

    result = await session.execute(
        select(ProductReview, User).join(User).where(
            ProductReview.product_id == product_id,
            ProductReview.is_hidden == False
        ).order_by(
            ProductReview.is_featured.desc(),
            ProductReview.helpful_count.desc(),
            ProductReview.created_at.desc()
        ).limit(limit).offset(offset)
    )

    reviews = result.all()

    return {
        "reviews": [{
            "id": review.id,
            "user": {
                "id": user.id,
                "username": user.username,
                "display_name": user.display_name
            },
            "rating": review.rating,
            "title": review.title,
            "comment": review.comment,
            "is_verified_purchase": review.is_verified_purchase,
            "helpful_count": review.helpful_count,
            "developer_response": review.developer_response,
            "created_at": review.created_at
        } for review, user in reviews],
        "page": page,
        "has_more": len(reviews) == limit
    }


# ===== ПУБЛІЧНИЙ МАРКЕТПЛЕЙС =====

@router.get("/public/products")
async def get_marketplace_products(
        category: Optional[str] = None,
        developer_id: Optional[int] = None,
        search: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        sort_by: str = Query("newest", pattern="^(newest|popular|rating|price_asc|price_desc)$"), # ВИПРАВЛЕНО ТУТ
        page: int = Query(1, ge=1),
        session: AsyncSession = Depends(get_session)
):
    """Отримати товари маркетплейсу"""

    limit = 12
    offset = (page - 1) * limit

    # Базовий запит
    query = select(
        MarketplaceProduct, Archive, DeveloperProfile
    ).join(Archive).join(DeveloperProfile).where(
        MarketplaceProduct.status == ProductStatus.APPROVED,
        Archive.is_active == True
    )

    # Фільтри
    if category:
        query = query.where(Archive.category == category)

    if developer_id:
        query = query.where(MarketplaceProduct.developer_id == developer_id)

    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                func.json_extract(Archive.title, '$.ua').ilike(search_term),
                func.json_extract(Archive.title, '$.en').ilike(search_term),
                Archive.code.ilike(search_term)
            )
        )

    if min_price is not None:
        query = query.where(Archive.price >= min_price)

    if max_price is not None:
        query = query.where(Archive.price <= max_price)

    # Сортування
    if sort_by == "newest":
        query = query.order_by(MarketplaceProduct.last_updated.desc())
    elif sort_by == "popular":
        query = query.order_by(MarketplaceProduct.sale_count.desc())
    elif sort_by == "rating":
        query = query.order_by(Archive.average_rating.desc())
    elif sort_by == "price_asc":
        query = query.order_by(Archive.price.asc())
    elif sort_by == "price_desc":
        query = query.order_by(Archive.price.desc())

    # Виконуємо запит
    result = await session.execute(query.limit(limit).offset(offset))
    products = result.all()

    return {
        "products": [{
            "id": product.id,
            "archive_id": archive.id,
            "code": archive.code,
            "title": archive.title,
            "description": archive.description,
            "price": archive.price,
            "images": archive.image_paths,
            "rating": archive.average_rating,
            "ratings_count": archive.ratings_count,
            "developer": {
                "id": developer.id,
                "name": developer.display_name,
                "slug": developer.slug,
                "is_verified": developer.is_verified
            },
            "version": product.version,
            "sale_count": product.sale_count
        } for product, archive, developer in products],
        "page": page,
        "has_more": len(products) == limit
    }


@router.get("/public/developers/{slug}")
async def get_developer_public_profile(
        slug: str,
        session: AsyncSession = Depends(get_session)
):
    """Отримати публічний профіль розробника"""

    result = await session.execute(
        select(DeveloperProfile).where(DeveloperProfile.slug == slug)
    )

    developer = result.scalar_one_or_none()

    if not developer:
        raise HTTPException(status_code=404, detail="Developer not found")

    return {
        "id": developer.id,
        "display_name": developer.display_name,
        "slug": developer.slug,
        "avatar_url": developer.avatar_url,
        "banner_url": developer.banner_url,
        "bio": developer.bio,
        "specializations": developer.specializations,
        "website": developer.website,
        "social_links": developer.social_links,
        "total_products": developer.total_products,
        "average_rating": developer.average_rating,
        "is_verified": developer.is_verified,
        "is_featured": developer.is_featured,
        "created_at": developer.created_at
    }