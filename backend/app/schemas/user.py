from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional


class UserCreate(BaseModel):
    email: EmailStr = Field(..., max_length=254)
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=30)


class UserLogin(BaseModel):
    email: EmailStr = Field(..., max_length=254)
    password: str = Field(..., max_length=30)


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = Field(None, max_length=254)
    username: Optional[str] = Field(None, min_length=1, max_length=50)


class PasswordUpdate(BaseModel):
    old_password: str = Field(..., max_length=30)
    new_password: str = Field(..., min_length=1, max_length=30)
