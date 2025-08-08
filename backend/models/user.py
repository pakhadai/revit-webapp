from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, Text
from sqlalchemy.sql import func
from database import Base


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

    # Bonuses and referrals
    bonuses = Column(Integer, default=0)
    referral_code = Column(String(50), unique=True, nullable=True)
    referred_by = Column(Integer, nullable=True)
    invited_count = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<User {self.username or self.user_id}>"