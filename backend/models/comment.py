# backend/models/comment.py
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean
from sqlalchemy.sql import func
from database import Base


class Comment(Base):
    __tablename__ = 'comments'

    id = Column(Integer, primary_key=True, autoincrement=True)
    archive_id = Column(Integer, ForeignKey('archives.id', ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)

    # Коментар
    text = Column(Text, nullable=False)

    # Відповідь на інший коментар (для вкладеності)
    parent_id = Column(Integer, ForeignKey('comments.id', ondelete="CASCADE"), nullable=True)

    # Модерація
    is_edited = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)  # М'яке видалення

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<Comment user_id={self.user_id} archive_id={self.archive_id}>"