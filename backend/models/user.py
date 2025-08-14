from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, Text
from sqlalchemy.sql import func
from database import Base
import uuid


class User(Base):
    __tablename__ = 'users'

    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, unique=True, nullable=False, index=True)  # Telegram ID

    # User info
    username = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    language_code = Column(String(10), default='en')

    # Role and permissions
    role = Column(String(50), default='user')  # user, client, premium, admin
    is_admin = Column(Boolean, default=False)

    # Subscription
    subscription_start = Column(DateTime, nullable=True)
    subscription_until = Column(DateTime, nullable=True)
    has_active_subscription = Column(Boolean, default=False)  # НОВЕ

    # Bonuses and referrals
    bonuses = Column(Integer, default=0)
    referral_code = Column(String(50), unique=True, nullable=True)
    referred_by = Column(Integer, nullable=True)
    invited_count = Column(Integer, default=0)

    # НОВІ поля для бонусної системи
    total_bonuses_earned = Column(Integer, default=0)  # Всього зароблено бонусів
    total_bonuses_spent = Column(Integer, default=0)  # Всього витрачено бонусів
    referral_earnings = Column(Integer, default=0)  # Заробіток з рефералів

    # VIP система
    vip_level = Column(String(20), default='bronze')  # bronze, silver, gold, diamond
    total_purchases_amount = Column(Float, default=0)  # Загальна сума покупок

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

    # Персональна інформація
    display_name = Column(String(100), nullable=True)
    bio = Column(Text, nullable=True)
    country = Column(String(2), nullable=True)
    timezone = Column(String(50), default='Europe/Kiev')

    # Безпека
    email_verified = Column(Boolean, default=False)
    phone_verified = Column(Boolean, default=False)
    two_factor_enabled = Column(Boolean, default=False)
    last_settings_update = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    last_active_at = Column(DateTime, nullable=True)  # НОВЕ

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Генеруємо унікальний реферальний код при створенні
        if not self.referral_code:
            self.referral_code = self.generate_referral_code()

    def generate_referral_code(self):
        """Генерує унікальний реферальний код"""
        return f"REF{self.user_id}{uuid.uuid4().hex[:6].upper()}"

    def __repr__(self):
        return f"<User {self.username or self.user_id}>"