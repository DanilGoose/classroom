from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Union


class SubmissionFileResponse(BaseModel):
    id: int
    file_name: str
    file_path: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class SubmissionCreate(BaseModel):
    content: Optional[str] = None


class SubmissionGrade(BaseModel):
    score: Union[int, str]  # Поддержка числовых и текстовых оценок
    teacher_comment: Optional[str] = None


class SubmissionResponse(BaseModel):
    id: int
    assignment_id: int
    student_id: int
    content: Optional[str]
    score: Optional[Union[int, str]]  # Поддержка числовых и текстовых оценок
    teacher_comment: Optional[str]
    submitted_at: datetime
    graded_at: Optional[datetime]
    files: List[SubmissionFileResponse] = []
    student_name: Optional[str] = None

    class Config:
        from_attributes = True
