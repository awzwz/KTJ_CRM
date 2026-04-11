from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr

from shared.constants.enums import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole = UserRole.OPERATOR
    branch_id: UUID | None = None


class UserRead(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: UserRole
    branch_id: UUID | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: UserRole | None = None
    branch_id: UUID | None = None
    is_active: bool | None = None


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    role: str
    exp: int
