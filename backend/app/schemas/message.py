from pydantic import BaseModel
from datetime import datetime


class MessageCreate(BaseModel):
    message: str


class MessageResponse(BaseModel):
    id: int
    assignment_id: int
    user_id: int
    username: str
    message: str
    created_at: datetime
    is_deleted: bool

    class Config:
        from_attributes = True
