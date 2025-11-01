from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Literal


class AssignmentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    grading_type: Literal["numeric", "text"] = "numeric"
    grade_min: Optional[int] = 2
    grade_max: Optional[int] = 5
    grade_options: Optional[List[str]] = None
    max_attempts: Optional[int] = None  # None = неограниченно


class AssignmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    grading_type: Optional[Literal["numeric", "text"]] = None
    grade_min: Optional[int] = None
    grade_max: Optional[int] = None
    grade_options: Optional[List[str]] = None
    max_attempts: Optional[int] = None


class AssignmentFileResponse(BaseModel):
    id: int
    file_name: str
    file_path: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class AssignmentResponse(BaseModel):
    id: int
    course_id: int
    title: str
    description: Optional[str]
    created_by: int
    created_at: datetime
    due_date: Optional[datetime]
    grading_type: str
    grade_min: Optional[int]
    grade_max: Optional[int]
    grade_options: Optional[str]  # JSON string
    max_attempts: Optional[int]
    files: List[AssignmentFileResponse] = []

    class Config:
        from_attributes = True
