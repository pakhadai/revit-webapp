# backend/models/view_history.py

from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from database import Base
import datetime

class ViewHistory(Base):
    __tablename__ = 'view_history'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)
    archive_id = Column(Integer, ForeignKey('archives.id', ondelete="CASCADE"), nullable=False, index=True)
    viewed_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint('user_id', 'archive_id', name='_user_archive_view_uc'),
    )

    def __repr__(self):
        return f"<ViewHistory user_id={self.user_id} archive_id={self.archive_id}>"