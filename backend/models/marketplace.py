# backend/models/marketplace.py
"""
Моделі для маркетплейсу розробників
Створіть цей новий файл в папці backend/models/
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum
from datetime import datetime


class DeveloperStatus(enum.Enum):
    """Статус розробника"""
    NONE = "none"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class ProductStatus(enum.Enum):
    """Статус товару в маркетплейсі"""
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"
    ARCHIVED = "archived"


class TransactionType(enum.Enum):
    """Тип транзакції"""
    SALE = "sale"
    COMMISSION = "commission"
    WITHDRAWAL = "withdrawal"
    REFUND = "refund"
    ADJUSTMENT = "adjustment"


class WithdrawalStatus(enum.Enum):
    """Статус виплати"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class DeveloperApplication(Base):
    """Заявка на статус розробника"""
    __tablename__ = 'developer_applications'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)

    # Інформація про розробника
    company_name = Column(String(200))
    portfolio_url = Column(String(500))
    description = Column(Text)
    specialization = Column(JSON)  # ["architecture", "furniture", "plumbing", etc.]

    # Контактна інформація
    contact_email = Column(String(200))
    contact_phone = Column(String(50))
    contact_telegram = Column(String(100))

    # Документи
    documents = Column(JSON)  # Список шляхів до документів

    # Статус заявки
    status = Column(Enum(DeveloperStatus), default=DeveloperStatus.PENDING)
    admin_notes = Column(Text)
    rejection_reason = Column(Text)

    # Дати
    submitted_at = Column(DateTime, server_default=func.now())
    reviewed_at = Column(DateTime)
    reviewed_by = Column(Integer, ForeignKey('users.id'))

    # Умови
    commission_rate = Column(Float, default=0.30)  # 30% комісія за замовчуванням
    accepted_terms = Column(Boolean, default=False)

    # Відносини
    user = relationship("User", foreign_keys=[user_id], backref="developer_applications")
    reviewer = relationship("User", foreign_keys=[reviewed_by])


class DeveloperProfile(Base):
    """Профіль розробника"""
    __tablename__ = 'developer_profiles'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), unique=True, nullable=False)

    # Публічна інформація
    display_name = Column(String(200), nullable=False)
    slug = Column(String(100), unique=True)  # URL-friendly ім'я
    avatar_url = Column(String(500))
    banner_url = Column(String(500))

    # Опис
    bio = Column(Text)
    specializations = Column(JSON)
    skills = Column(JSON)

    # Контакти
    website = Column(String(500))
    social_links = Column(JSON)  # {"telegram": "@user", "instagram": "@user"}

    # Статистика
    total_products = Column(Integer, default=0)
    total_sales = Column(Integer, default=0)
    total_revenue = Column(Float, default=0.0)
    average_rating = Column(Float, default=0.0)

    # Фінанси
    balance = Column(Float, default=0.0)
    total_earned = Column(Float, default=0.0)
    total_withdrawn = Column(Float, default=0.0)
    commission_rate = Column(Float, default=0.30)

    # Статус
    is_verified = Column(Boolean, default=False)
    is_featured = Column(Boolean, default=False)
    status = Column(Enum(DeveloperStatus), default=DeveloperStatus.APPROVED)

    # Дати
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    last_payout_at = Column(DateTime)

    # Відносини
    user = relationship("User", backref="developer_profile")


class MarketplaceProduct(Base):
    """Товар в маркетплейсі"""
    __tablename__ = 'marketplace_products'

    id = Column(Integer, primary_key=True)
    archive_id = Column(Integer, ForeignKey('archives.id'), nullable=False)
    developer_id = Column(Integer, ForeignKey('developer_profiles.id'), nullable=False)

    # Статус
    status = Column(Enum(ProductStatus), default=ProductStatus.DRAFT)

    # Модерація
    submitted_at = Column(DateTime)
    reviewed_at = Column(DateTime)
    reviewed_by = Column(Integer, ForeignKey('users.id'))
    review_notes = Column(Text)
    rejection_reason = Column(Text)

    # Статистика
    view_count = Column(Integer, default=0)
    sale_count = Column(Integer, default=0)
    revenue = Column(Float, default=0.0)

    # SEO
    meta_title = Column(String(200))
    meta_description = Column(Text)
    meta_keywords = Column(JSON)

    # Промо
    is_featured = Column(Boolean, default=False)
    featured_until = Column(DateTime)
    promo_video_url = Column(String(500))

    # Версіонування
    version = Column(String(20))
    changelog = Column(Text)
    last_updated = Column(DateTime, server_default=func.now())

    # Відносини
    archive = relationship("Archive", backref="marketplace_product")
    developer = relationship("DeveloperProfile", backref="products")
    reviewer = relationship("User")


class MarketplaceTransaction(Base):
    """Транзакції в маркетплейсі"""
    __tablename__ = 'marketplace_transactions'

    id = Column(Integer, primary_key=True)

    # Учасники
    developer_id = Column(Integer, ForeignKey('developer_profiles.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'))  # Покупець (якщо є)

    # Тип та сума
    type = Column(Enum(TransactionType), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default='USD')

    # Деталі
    description = Column(Text)
    reference_id = Column(String(100))  # ID замовлення, виплати, etc.
    product_id = Column(Integer, ForeignKey('marketplace_products.id'))

    # Комісія
    commission_amount = Column(Float, default=0.0)
    developer_amount = Column(Float)  # Сума після комісії

    # Статус
    status = Column(String(50), default='completed')

    # Дати
    created_at = Column(DateTime, server_default=func.now())

    # Відносини
    developer = relationship("DeveloperProfile", backref="transactions")
    user = relationship("User", backref="marketplace_purchases")
    product = relationship("MarketplaceProduct")


class DeveloperWithdrawal(Base):
    """Запити на виплату коштів"""
    __tablename__ = 'developer_withdrawals'

    id = Column(Integer, primary_key=True)
    developer_id = Column(Integer, ForeignKey('developer_profiles.id'), nullable=False)

    # Сума
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default='USD')

    # Платіжні реквізити
    payment_method = Column(String(50))  # "crypto", "bank", "paypal"
    payment_details = Column(JSON)  # Зашифровані реквізити

    # Статус
    status = Column(Enum(WithdrawalStatus), default=WithdrawalStatus.PENDING)

    # Обробка
    processed_at = Column(DateTime)
    processed_by = Column(Integer, ForeignKey('users.id'))
    transaction_id = Column(String(200))  # ID транзакції в платіжній системі

    # Примітки
    notes = Column(Text)
    rejection_reason = Column(Text)

    # Дати
    requested_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime)

    # Відносини
    developer = relationship("DeveloperProfile", backref="withdrawals")
    processor = relationship("User")


class ProductReview(Base):
    """Відгуки на товари маркетплейсу"""
    __tablename__ = 'product_reviews'

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey('marketplace_products.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)

    # Оцінка
    rating = Column(Integer, nullable=False)  # 1-5

    # Відгук
    title = Column(String(200))
    comment = Column(Text)

    # Медіа
    images = Column(JSON)  # Список шляхів до зображень

    # Корисність
    helpful_count = Column(Integer, default=0)
    not_helpful_count = Column(Integer, default=0)

    # Відповідь розробника
    developer_response = Column(Text)
    developer_response_at = Column(DateTime)

    # Статус
    is_verified_purchase = Column(Boolean, default=False)
    is_featured = Column(Boolean, default=False)
    is_hidden = Column(Boolean, default=False)

    # Дати
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Відносини
    product = relationship("MarketplaceProduct", backref="reviews")
    user = relationship("User", backref="product_reviews")


class DeveloperAnalytics(Base):
    """Аналітика для розробників"""
    __tablename__ = 'developer_analytics'

    id = Column(Integer, primary_key=True)
    developer_id = Column(Integer, ForeignKey('developer_profiles.id'), nullable=False)
    date = Column(DateTime, nullable=False)

    # Метрики
    views = Column(Integer, default=0)
    unique_visitors = Column(Integer, default=0)
    sales = Column(Integer, default=0)
    revenue = Column(Float, default=0.0)

    # Конверсія
    add_to_cart = Column(Integer, default=0)
    checkout_started = Column(Integer, default=0)

    # По товарах
    product_metrics = Column(JSON)  # {"product_id": {"views": 0, "sales": 0}}

    # Джерела трафіку
    traffic_sources = Column(JSON)  # {"direct": 0, "search": 0, "social": 0}

    # Відносини
    developer = relationship("DeveloperProfile")
