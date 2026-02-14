from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)
    is_email_verified = Column(Boolean, default=False, nullable=False)
    email_verification_code = Column(String(6), nullable=True)
    email_verification_expires_at = Column(DateTime, nullable=True)
    email_verification_sent_at = Column(DateTime, nullable=True)
    email_change_old_code = Column(String(6), nullable=True)
    email_change_old_expires_at = Column(DateTime, nullable=True)
    email_change_old_sent_at = Column(DateTime, nullable=True)
    pending_email = Column(String, nullable=True)
    pending_email_code = Column(String(6), nullable=True)
    pending_email_expires_at = Column(DateTime, nullable=True)
    pending_email_sent_at = Column(DateTime, nullable=True)
    password_reset_code = Column(String(6), nullable=True)
    password_reset_expires_at = Column(DateTime, nullable=True)
    password_reset_sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    created_courses = relationship("Course", back_populates="creator", cascade="all, delete-orphan")
    course_memberships = relationship("CourseMember", back_populates="user", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="creator", cascade="all, delete-orphan")
    messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")
