# backend/models/notification.py
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.sql import func
from database import Base
import datetime


class Notification(Base):
    __tablename__ = 'notifications'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)

    message = Column(String, nullable=False)
    type = Column(String, default="info")  # 'info', 'rate_reminder'
    related_archive_id = Column(Integer, ForeignKey('archives.id'), nullable=True)

    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)