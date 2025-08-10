# backend/models/favorite.py

from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from database import Base

class Favorite(Base):
    __tablename__ = 'favorites'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    archive_id = Column(Integer, ForeignKey('archives.id'), nullable=False, index=True)

    # Унікальне обмеження, щоб користувач не міг двічі додати один і той самий товар
    __table_args__ = (
        UniqueConstraint('user_id', 'archive_id', name='_user_archive_uc'),
    )

    def __repr__(self):
        return f"<Favorite user_id={self.user_id} archive_id={self.archive_id}>"
