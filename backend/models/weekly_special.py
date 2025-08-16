# backend/models/weekly_special.py
"""
Модель для Сімейства тижня - спеціальних пропозицій
"""

from sqlalchemy import Column, Integer, Float, Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship
from datetime import datetime
import pytz

from database import Base

KYIV_TZ = pytz.timezone('Europe/Kiev')


class WeeklySpecial(Base):
    """Модель для спеціальних тижневих пропозицій"""
    __tablename__ = "weekly_specials"

    id = Column(Integer, primary_key=True, index=True)

    # Зв'язок з архівом
    archive_id = Column(Integer, ForeignKey("archives.id"), nullable=False)
    archive = relationship("Archive", back_populates="weekly_specials")

    # Знижка
    discount_percent = Column(Integer, nullable=False)  # Відсоток знижки (30, 40, 50...)
    discount_price = Column(Float, nullable=False)  # Ціна зі знижкою

    # Період дії
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)

    # Додаткові бонуси
    bonus_multiplier = Column(Float, default=1.0)  # Множник бонусів (1.5x, 2x...)

    # Статус
    is_active = Column(Boolean, default=True)

    # Статистика
    views_count = Column(Integer, default=0)
    clicks_count = Column(Integer, default=0)

    # Метадані
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(KYIV_TZ))
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Опціональні поля для маркетингу
    marketing_text = Column(String, nullable=True)  # Спеціальний текст для промо
    badge_text = Column(String, default="MEGA SALE")  # Текст на бейджі

    def __repr__(self):
        return f"<WeeklySpecial(archive_id={self.archive_id}, discount={self.discount_percent}%)>"

    @property
    def is_valid(self):
        """Перевірка чи пропозиція ще діє"""
        now = datetime.now(KYIV_TZ)
        return self.is_active and self.start_date <= now <= self.end_date

    @property
    def time_left(self):
        """Скільки часу залишилось до кінця"""
        now = datetime.now(KYIV_TZ)
        if now > self.end_date:
            return None
        return self.end_date - now

    @property
    def savings_amount(self):
        """Сума економії"""
        if self.archive:
            return self.archive.price - self.discount_price
        return 0
