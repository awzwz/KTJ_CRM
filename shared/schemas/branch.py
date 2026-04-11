from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class BranchCreate(BaseModel):
    name: str
    code: str
    branch_type: str = "regional"


class BranchRead(BaseModel):
    id: UUID
    name: str
    code: str
    branch_type: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
