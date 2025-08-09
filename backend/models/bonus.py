from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Date
from sqlalchemy.types import Enum as SQLEnum  # ЗМІНИТИ
from sqlalchemy.sql import func
from database import Base
import enum

class BonusTransactionType(enum.Enum):
    # Нарахування
    PURCHASE_CASHBACK = "purchase_cashback"  # Кешбек з покупки
    REFERRAL_BONUS = "referral_bonus"  # Бонус за реферала
    REFERRAL_PURCHASE = "referral_purchase"  # % від покупки реферала
    DAILY_CLAIM = "daily_claim"  # Щоденний бонус
    SLOT_JACKPOT = "slot_jackpot"  # Виграш у слоті
    STREAK_RESTORE = "streak_restore"  # Відновлення стріку
    ADMIN_BONUS = "admin_bonus"  # Адмін нарахував

    # Витрати
    PURCHASE_PAYMENT = "purchase_payment"  # Оплата покупки
    SUBSCRIPTION_PAYMENT = "subscription_payment"  # Оплата підписки
    STREAK_RESTORE_FEE = "streak_restore_fee"  # Плата за відновлення


class BonusTransaction(Base):
    __tablename__ = 'bonus_transactions'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)

    amount = Column(Integer, nullable=False)  # Додатнє для нарахування, від'ємне для витрат
    balance_after = Column(Integer, nullable=False)  # Баланс після транзакції

    type = Column(SQLEnum(BonusTransactionType), nullable=False)
    description = Column(String(255))

    # Зв'язки з іншими сутностями
    order_id = Column(Integer, ForeignKey('orders.id'), nullable=True)
    referral_id = Column(Integer, ForeignKey('users.id'), nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<BonusTransaction user={self.user_id} amount={self.amount} type={self.type}>"


class DailyBonus(Base):
    __tablename__ = 'daily_bonuses'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, unique=True)

    # Стрік
    last_claim_date = Column(Date, nullable=True)
    streak_count = Column(Integer, default=0)
    streak_restored = Column(Boolean, default=False)  # Чи був відновлений стрік
    max_streak = Column(Integer, default=0)  # Найдовший стрік користувача

    # Статистика
    total_claimed = Column(Integer, default=0)  # Всього отримано бонусів
    total_claims = Column(Integer, default=0)  # Кількість отримань
    slot_wins = Column(Integer, default=0)  # Кількість джекпотів у слоті

    # Слот машина
    last_slot_result = Column(String(20), nullable=True)  # Останній результат слоту

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<DailyBonus user={self.user_id} streak={self.streak_count}>"


class UserReferral(Base):
    __tablename__ = 'user_referrals'

    id = Column(Integer, primary_key=True, autoincrement=True)
    referrer_id = Column(Integer, ForeignKey('users.id'), nullable=False)  # Хто запросив
    referred_id = Column(Integer, ForeignKey('users.id'), nullable=False, unique=True)  # Кого запросили

    # Статус
    first_purchase_made = Column(Boolean, default=False)  # Чи зробив першу покупку
    first_purchase_date = Column(DateTime, nullable=True)

    # Статистика
    total_purchases = Column(Integer, default=0)  # Кількість покупок реферала
    total_spent = Column(Float, default=0)  # Загальна сума покупок реферала
    total_earned = Column(Float, default=0)  # Скільки заробив реферер
    bonuses_earned = Column(Integer, default=0)  # Скільки бонусів заробив реферер

    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<UserReferral referrer={self.referrer_id} referred={self.referred_id}>"


class VipLevel(Base):
    __tablename__ = 'vip_levels'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, unique=True)

    # Прогрес
    total_spent = Column(Float, default=0)  # Загальна сума покупок
    current_level = Column(String(20), default='bronze')  # bronze, silver, gold, diamond
    cashback_rate = Column(Float, default=3.0)  # Відсоток кешбеку

    # Наступний рівень
    next_level = Column(String(20), nullable=True)
    amount_to_next = Column(Float, nullable=True)  # Скільки треба витратити до наступного рівня

    # Статистика
    total_cashback_earned = Column(Integer, default=0)  # Всього отримано кешбеку
    purchases_count = Column(Integer, default=0)  # Кількість покупок

    # Дати
    level_updated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<VipLevel user={self.user_id} level={self.current_level}>"