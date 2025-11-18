from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class CourseCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=200)


class CourseUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=200)


class CourseJoin(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)


class CourseResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    code: str
    creator_id: int
    created_at: datetime
    is_archived: int = 0
    is_creator: bool = False
    member_count: int = 0

    class Config:
        from_attributes = True


class CourseMemberResponse(BaseModel):
    id: int
    user_id: int
    username: str
    email: str
    joined_at: datetime

    class Config:
        from_attributes = True
