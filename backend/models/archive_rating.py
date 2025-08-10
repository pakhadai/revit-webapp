# backend/models/archive_rating.py

from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint, CheckConstraint
from database import Base


class ArchiveRating(Base):
    __tablename__ = 'archive_ratings'

    id = Column(Integer, primary_key=True, autoincrement=True)
    archive_id = Column(Integer, ForeignKey('archives.id', ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)

    # Оцінка від 1 до 5
    rating = Column(Integer, nullable=False)

    __table_args__ = (
        # Користувач може залишити тільки одну оцінку для одного архіву
        UniqueConstraint('user_id', 'archive_id', name='_user_archive_rating_uc'),
        # Перевірка, що оцінка знаходиться в межах від 1 до 5
        CheckConstraint('rating >= 1 AND rating <= 5', name='rating_check')
    )

    def __repr__(self):
        return f"<ArchiveRating user_id={self.user_id} archive_id={self.archive_id} rating={self.rating}>"