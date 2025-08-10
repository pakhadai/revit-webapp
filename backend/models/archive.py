# backend/models/archive.py

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON, ForeignKey
from sqlalchemy.sql import func
from database import Base


class Archive(Base):
    __tablename__ = 'archives'

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(100), unique=True, nullable=False, index=True)

    # Content
    title = Column(JSON, nullable=False)
    description = Column(JSON, nullable=False)

    # Files
    image_path = Column(String(500))
    file_path = Column(String(500))

    # Pricing
    price = Column(Float, default=0.0)
    discount_percent = Column(Integer, default=0)

    # Type
    archive_type = Column(String(50), default='premium')

    # Metadata
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    published_at = Column(DateTime, nullable=True)

    # Statistics
    purchase_count = Column(Integer, default=0)
    view_count = Column(Integer, default=0)

    # НОВІ ПОЛЯ ДЛЯ РЕЙТИНГУ
    average_rating = Column(Float, default=0.0)
    ratings_count = Column(Integer, default=0)

    def __repr__(self):
        return f"<Archive {self.code}>"


class ArchivePurchase(Base):
    __tablename__ = 'archive_purchases'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    archive_id = Column(Integer, ForeignKey('archives.id'), nullable=False)

    price_paid = Column(Float, nullable=False)
    bonuses_used = Column(Integer, default=0)

    purchased_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<ArchivePurchase user={self.user_id} archive={self.archive_id}>"