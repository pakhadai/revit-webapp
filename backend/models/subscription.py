from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Enum
from sqlalchemy.sql import func
from database import Base
import enum


class SubscriptionStatus(enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    PENDING = "pending"


class SubscriptionPlan(enum.Enum):
    MONTHLY = "monthly"
    YEARLY = "yearly"


class Subscription(Base):
    __tablename__ = 'subscriptions'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)

    # План і статус
    plan = Column(Enum(SubscriptionPlan), default=SubscriptionPlan.MONTHLY)
    status = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.PENDING)

    # Дати
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)

    # Оплата
    payment_method = Column(String(50))  # cryptomus, bonuses, card
    amount_paid = Column(Float, nullable=False)
    bonuses_used = Column(Integer, default=0)

    # Автопродовження
    auto_renew = Column(Boolean, default=False)
    reminder_sent = Column(Boolean, default=False)

    # Метадані
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    cancelled_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<Subscription user={self.user_id} status={self.status}>"


class SubscriptionArchive(Base):
    """Архіви, доступні користувачу через підписку"""
    __tablename__ = 'subscription_archives'

    id = Column(Integer, primary_key=True, autoincrement=True)
    subscription_id = Column(Integer, ForeignKey('subscriptions.id'), nullable=False)
    archive_id = Column(Integer, ForeignKey('archives.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)  # для швидкого пошуку

    unlocked_at = Column(DateTime, server_default=func.now())

    # Унікальність - користувач не може двічі розблокувати той самий архів
    __table_args__ = (
        {'mysql_charset': 'utf8mb4', 'mysql_collate': 'utf8mb4_unicode_ci'},
    )

    def __repr__(self):
        return f"<SubscriptionArchive sub={self.subscription_id} archive={self.archive_id}>"
    