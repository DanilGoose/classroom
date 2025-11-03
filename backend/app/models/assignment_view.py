from sqlalchemy import Column, Integer, DateTime, ForeignKey
from datetime import datetime
from ..database import Base


class AssignmentView(Base):
    """Модель для отслеживания просмотренных заданий студентами"""
    __tablename__ = "assignment_views"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    viewed_at = Column(DateTime, default=datetime.utcnow)
