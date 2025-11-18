from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Literal


class AssignmentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    due_date: Optional[datetime] = None
    grading_type: Literal["numeric", "text"] = "numeric"
    grade_min: Optional[int] = Field(None, ge=-1000000, le=1000000)
    grade_max: Optional[int] = Field(None, ge=-1000000, le=1000000)
    grade_options: Optional[List[str]] = Field(None, max_length=50)
    max_attempts: Optional[int] = Field(None, ge=1, le=1000)


class AssignmentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    due_date: Optional[datetime] = None
    grading_type: Optional[Literal["numeric", "text"]] = None
    grade_min: Optional[int] = Field(None, ge=-1000000, le=1000000)
    grade_max: Optional[int] = Field(None, ge=-1000000, le=1000000)
    grade_options: Optional[List[str]] = Field(None, max_length=50)
    max_attempts: Optional[int] = Field(None, ge=1, le=1000)


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
