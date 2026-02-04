from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.db.base import Base


class MediaSecondInboxItem(Base):
    __tablename__ = "media_second_inbox_items"

    id = Column(Integer, primary_key=True)
    webp_path = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
