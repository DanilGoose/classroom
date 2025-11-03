from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text)  # Текст сдачи
    score = Column(String, nullable=True)  # Оценка от учителя (может быть числом или текстом)
    teacher_comment = Column(Text, nullable=True)  # Комментарий учителя
    submitted_at = Column(DateTime, default=datetime.utcnow)
    graded_at = Column(DateTime, nullable=True)
    is_deleted = Column(Integer, default=0)  # 0 = не удалено, 1 = удалено
    viewed_by_teacher = Column(Integer, default=0)  # 0 = не просмотрено, 1 = просмотрено

    # Relationships
    assignment = relationship("Assignment", back_populates="submissions")
    student = relationship("User", foreign_keys=[student_id])
    files = relationship("SubmissionFile", back_populates="submission", cascade="all, delete-orphan")


class SubmissionFile(Base):
    __tablename__ = "submission_files"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    file_path = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    submission = relationship("Submission", back_populates="files")
