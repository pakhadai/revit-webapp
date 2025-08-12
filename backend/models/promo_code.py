# backend/models/promo_code.py

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Enum as SQLEnum
from sqlalchemy.sql import func
from database import Base
from datetime import datetime
import enum


class DiscountType(enum.Enum):
    PERCENTAGE = "percentage"
    FIXED_AMOUNT = "fixed_amount"


class PromoCode(Base):
    __tablename__ = 'promo_codes'

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), unique=True, nullable=False, index=True)

    # Тип та розмір знижки
    discount_type = Column(SQLEnum(DiscountType), nullable=False)
    value = Column(Float, nullable=False)  # Відсоток (напр. 15) або сума (напр. 5.00)

    # Обмеження
    expires_at = Column(DateTime, nullable=True)
    max_uses = Column(Integer, nullable=True)  # NULL = необмежено
    current_uses = Column(Integer, default=0)
    min_purchase_amount = Column(Float, default=0)  # Мінімальна сума замовлення

    # Статус
    is_active = Column(Boolean, default=True)  # ← ВАЖЛИВО: Boolean, не Integer!

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())  # Додав для повноти

    def __repr__(self):
        return f"<PromoCode {self.code}>"

    def is_valid(self):
        """Перевірка чи промокод дійсний"""
        if not self.is_active:
            return False

        if self.expires_at and self.expires_at < datetime.utcnow():
            return False

        if self.max_uses and self.current_uses >= self.max_uses:
            return False

        return True