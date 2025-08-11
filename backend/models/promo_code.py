# backend/models/promo_code.py
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum as SQLEnum
from sqlalchemy.sql import func
from database import Base
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
    max_uses = Column(Integer, nullable=True)  # Максимальна кількість використань
    current_uses = Column(Integer, default=0)  # Поточна кількість використань

    # Статус
    is_active = Column(Integer, default=1)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<PromoCode {self.code}>"