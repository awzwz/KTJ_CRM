from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

from shared.constants.enums import MessageDirection, MessageChannel


class MessageCreate(BaseModel):
    appeal_id: UUID
    direction: MessageDirection
    content: str
    channel: MessageChannel = MessageChannel.WHATSAPP
    external_id: str | None = None


class MessageRead(BaseModel):
    id: UUID
    appeal_id: UUID
    direction: str
    content: str
    channel: str
    external_id: str | None
    sent_at: datetime

    model_config = {"from_attributes": True}
