from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    due_date = Column(DateTime, nullable=True)

    # Поля для оценивания
    grading_type = Column(String, default="numeric")  # "numeric" или "text"
    grade_min = Column(Integer, default=2)  # Минимальное значение для числовой оценки
    grade_max = Column(Integer, default=5)  # Максимальное значение для числовой оценки
    grade_options = Column(Text, nullable=True)  # JSON массив опций для текстовой оценки
    max_attempts = Column(Integer, nullable=True)  # Максимальное количество попыток сдачи (null = неограничено)

    # Relationships
    course = relationship("Course", back_populates="assignments")
    creator = relationship("User", back_populates="assignments")
    files = relationship("AssignmentFile", back_populates="assignment", cascade="all, delete-orphan")
    messages = relationship("ChatMessage", back_populates="assignment", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="assignment", cascade="all, delete-orphan")


class AssignmentFile(Base):
    __tablename__ = "assignment_files"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    file_path = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    assignment = relationship("Assignment", back_populates="files")
