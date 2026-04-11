from datetime import datetime, date
from uuid import UUID
from pydantic import BaseModel

from shared.constants.enums import (
    AppealCategory,
    AppealSubcategory,
    AppealStatus,
    AppealSource,
    Language,
)


class AppealCreate(BaseModel):
    category: AppealCategory
    subcategory: AppealSubcategory | None = None
    source: AppealSource = AppealSource.WHATSAPP
    train_number: int | None = None
    event_date: date | None = None
    language: Language = Language.RUSSIAN
    client_phone: str | None = None
    client_message: str | None = None
    car_number: int | None = None
    seat_number: int | None = None
    station_name: str | None = None
    cashier_name: str | None = None
    item_description: str | None = None
    ticket_number: str | None = None
    return_status: str | None = None
    metadata_json: dict | None = None


class AppealRead(BaseModel):
    id: UUID
    category: str
    subcategory: str | None
    status: str
    source: str
    train_number: int | None
    event_date: date | None
    language: str
    client_phone: str | None
    client_message: str | None
    auto_response: str | None
    car_number: int | None
    seat_number: int | None
    station_name: str | None
    cashier_name: str | None
    item_description: str | None
    ticket_number: str | None
    return_status: str | None
    llm_category: str | None
    llm_confidence: float | None
    metadata_json: dict | None = None
    assigned_to: UUID | None
    branch_id: UUID | None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None
    first_response_at: datetime | None

    model_config = {"from_attributes": True}


class AppealUpdate(BaseModel):
    status: AppealStatus | None = None
    assigned_to: UUID | None = None
    branch_id: UUID | None = None
    auto_response: str | None = None


class AppealListItem(BaseModel):
    id: UUID
    category: str
    subcategory: str | None
    status: str
    source: str
    train_number: int | None
    client_phone: str | None
    assigned_to: UUID | None
    branch_id: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}
