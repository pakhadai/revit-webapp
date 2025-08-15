from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, Text, Enum as SQLEnum
from sqlalchemy.sql import func
from database import Base
import enum


# Визначаємо UserRole як enum
class UserRole(enum.Enum):
    USER = "user"
    MODERATOR = "moderator"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


class User(Base):
    __tablename__ = "users"

    # Основні поля
    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(String, unique=True, index=True, nullable=False)

    # Telegram дані
    username = Column(String, nullable=True)  # @username
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    language_code = Column(String, default="ua")
    avatar_url = Column(String, nullable=True)  # URL аватара
    is_onboarded = Column(Boolean, default=False)

    # Роль і права (ВАЖЛИВО - використовуємо SQLEnum правильно)
    role = Column(SQLEnum(UserRole), default=UserRole.USER)
    is_active = Column(Boolean, default=True)
    is_premium = Column(Boolean, default=False)  # Telegram Premium

    # Підписка
    has_subscription = Column(Boolean, default=False)
    subscription_until = Column(DateTime, nullable=True)

    # Бонуси і баланс
    balance = Column(Float, default=0.0)
    bonus_balance = Column(Integer, default=0)
    total_spent = Column(Float, default=0.0)

    # VIP статус
    vip_level = Column(String, default="bronze")  # bronze, silver, gold, diamond

    # Реферальна система
    referral_code = Column(String, unique=True, nullable=True)
    referred_by = Column(Integer, nullable=True)
    referral_earnings = Column(Float, default=0.0)

    # Дати
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_active = Column(DateTime(timezone=True), server_default=func.now())

    # Daily bonus
    daily_bonus_streak = Column(Integer, default=0)
    last_daily_bonus = Column(DateTime, nullable=True)

    # Налаштування
    notifications_enabled = Column(Boolean, default=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)

    # Додаткові поля для профілю
    bio = Column(Text, nullable=True)
    country = Column(String, nullable=True)
    timezone = Column(String, default="Europe/Kiev")

    # Налаштування сповіщень
    notify_new_archives = Column(Boolean, default=True)
    notify_promotions = Column(Boolean, default=True)
    notify_bonuses = Column(Boolean, default=True)
    notify_order_status = Column(Boolean, default=True)
    notify_subscription_expiry = Column(Boolean, default=True)

    # Налаштування інтерфейсу
    theme = Column(String(20), default='auto')
    compact_view = Column(Boolean, default=False)
    show_prices_with_vat = Column(Boolean, default=False)

    # Налаштування конфіденційності
    profile_visibility = Column(String(20), default='public')
    show_purchase_history = Column(Boolean, default=True)
    allow_friend_requests = Column(Boolean, default=True)

    # Персональна інформація (оновлення)
    display_name = Column(String(100), nullable=True)

    # Безпека
    email_verified = Column(Boolean, default=False)
    phone_verified = Column(Boolean, default=False)
    two_factor_enabled = Column(Boolean, default=False)
    last_settings_update = Column(DateTime, nullable=True)

@property
def is_admin(self):
    """Property для перевірки чи користувач є адміністратором"""
    return self.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]