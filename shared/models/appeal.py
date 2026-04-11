import uuid
from datetime import datetime, date

from sqlalchemy import String, Integer, Text, Date, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from shared.database import Base


class Appeal(Base):
    __tablename__ = "appeals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    category: Mapped[str] = mapped_column(String(50), index=True)
    subcategory: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="new", index=True)
    source: Mapped[str] = mapped_column(String(50), default="whatsapp")

    train_number: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    language: Mapped[str] = mapped_column(String(5), default="ru")

    client_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    client_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    auto_response: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Gratitude-specific
    car_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    seat_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    station_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cashier_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Lost items-specific
    item_description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Ticket return-specific
    ticket_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    return_status: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # LLM classification
    llm_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    llm_confidence: Mapped[float | None] = mapped_column(nullable=True)

    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    first_response_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    assigned_to_user = relationship("User", back_populates="assigned_appeals")
    branch = relationship("Branch", back_populates="appeals")
    history = relationship("AppealHistory", back_populates="appeal", order_by="AppealHistory.changed_at")
    messages = relationship("Message", back_populates="appeal", order_by="Message.sent_at")


class AppealHistory(Base):
    __tablename__ = "appeal_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    appeal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appeals.id"), index=True
    )
    old_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    new_status: Mapped[str] = mapped_column(String(50))
    changed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    appeal = relationship("Appeal", back_populates="history")
