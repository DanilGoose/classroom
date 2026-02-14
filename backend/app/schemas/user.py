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
    is_email_verified: bool
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


class EmailVerificationConfirm(BaseModel):
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class EmailChangeRequestNewCode(BaseModel):
    old_code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_email: EmailStr = Field(..., max_length=254)


class EmailChangeConfirmNewEmail(BaseModel):
    new_code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class RegistrationConfirm(BaseModel):
    email: EmailStr = Field(..., max_length=254)
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class PasswordResetRequest(BaseModel):
    email: EmailStr = Field(..., max_length=254)


class PasswordResetConfirm(BaseModel):
    email: EmailStr = Field(..., max_length=254)
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(..., min_length=1, max_length=30)
