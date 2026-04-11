from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status as http_status

from shared.database import get_db
from shared.models.appeal import Appeal, AppealHistory
from shared.schemas.appeal import AppealCreate, AppealListItem, AppealRead, AppealUpdate
from app.events import publish_event

router = APIRouter(prefix="/appeals", tags=["appeals"])

VALID_TRANSITIONS = {
    "new": ["in_progress"],
    "in_progress": ["on_review", "resolved"],
    "on_review": ["in_progress", "resolved"],
    "resolved": ["closed", "in_progress"],
    "closed": [],
}


class AppealListResponse(BaseModel):
    items: list[AppealListItem]
    total: int


class AppealHistoryItem(BaseModel):
    id: UUID
    old_status: str | None
    new_status: str
    changed_by: UUID | None
    comment: str | None
    changed_at: datetime

    model_config = {"from_attributes": True}


def _enum_value(v):
    return v.value if hasattr(v, "value") else v


@router.get("", response_model=AppealListResponse)
async def list_appeals(
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: str | None = None,
    category: str | None = None,
    branch_id: UUID | None = None,
    assigned_to: UUID | None = None,
    source: str | None = None,
):
    base_q = select(Appeal)
    if status is not None:
        base_q = base_q.where(Appeal.status == status)
    if category is not None:
        base_q = base_q.where(Appeal.category == category)
    if branch_id is not None:
        base_q = base_q.where(Appeal.branch_id == branch_id)
    if assigned_to is not None:
        base_q = base_q.where(Appeal.assigned_to == assigned_to)
    if source is not None:
        base_q = base_q.where(Appeal.source == source)

    count_q = select(func.count()).select_from(base_q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    q = base_q.order_by(Appeal.created_at.desc()).offset(skip).limit(limit)
    items = list((await db.execute(q)).scalars().all())

    return AppealListResponse(items=items, total=total)


@router.get("/{appeal_id}", response_model=AppealRead)
async def get_appeal(
    appeal_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    appeal = (await db.execute(select(Appeal).where(Appeal.id == appeal_id))).scalar_one_or_none()
    if appeal is None:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Appeal not found")
    return appeal


@router.get("/{appeal_id}/history", response_model=list[AppealHistoryItem])
async def get_appeal_history(
    appeal_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get the status change history for an appeal."""
    appeal = (await db.execute(select(Appeal).where(Appeal.id == appeal_id))).scalar_one_or_none()
    if appeal is None:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Appeal not found")

    result = await db.execute(
        select(AppealHistory)
        .where(AppealHistory.appeal_id == appeal_id)
        .order_by(AppealHistory.changed_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=AppealRead, status_code=http_status.HTTP_201_CREATED)
async def create_appeal(
    body: AppealCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    appeal = Appeal(
        category=_enum_value(body.category),
        subcategory=_enum_value(body.subcategory) if body.subcategory is not None else None,
        source=_enum_value(body.source),
        train_number=body.train_number,
        event_date=body.event_date,
        language=_enum_value(body.language),
        client_phone=body.client_phone,
        client_message=body.client_message,
        car_number=body.car_number,
        seat_number=body.seat_number,
        station_name=body.station_name,
        cashier_name=body.cashier_name,
        item_description=body.item_description,
        ticket_number=body.ticket_number,
        return_status=body.return_status,
        metadata_json=body.metadata_json,
        status="new",
    )
    db.add(appeal)
    await db.flush()

    # Initial history entry
    db.add(AppealHistory(
        appeal_id=appeal.id,
        old_status=None,
        new_status="new",
        comment="Обращение создано",
    ))

    await db.commit()
    await db.refresh(appeal)

    await publish_event("appeal.created", {
        "id": str(appeal.id),
        "category": appeal.category,
        "status": appeal.status,
        "train_number": appeal.train_number,
        "client_phone": appeal.client_phone,
        "branch_id": str(appeal.branch_id) if appeal.branch_id else None,
        "source": appeal.source,
    })

    return appeal


@router.patch("/{appeal_id}", response_model=AppealRead)
async def update_appeal(
    appeal_id: UUID,
    body: AppealUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    appeal = (await db.execute(select(Appeal).where(Appeal.id == appeal_id))).scalar_one_or_none()
    if appeal is None:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Appeal not found")

    data = body.model_dump(exclude_unset=True)
    old_status = appeal.status

    # Status transition validation
    new_status = data.get("status")
    if new_status is not None:
        new_status = _enum_value(new_status)
        allowed = VALID_TRANSITIONS.get(old_status, [])
        if new_status not in allowed:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Cannot transition from '{old_status}' to '{new_status}'. Allowed: {allowed}",
            )

    for key, value in data.items():
        setattr(appeal, key, _enum_value(value) if value is not None else None)

    # Track status change
    if new_status and new_status != old_status:
        db.add(AppealHistory(
            appeal_id=appeal.id,
            old_status=old_status,
            new_status=new_status,
            changed_by=data.get("assigned_to"),
        ))

        if new_status in ("resolved", "closed") and appeal.resolved_at is None:
            appeal.resolved_at = datetime.now(timezone.utc)

        if new_status == "in_progress" and appeal.first_response_at is None:
            appeal.first_response_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(appeal)

    await publish_event("appeal.updated", {
        "id": str(appeal.id),
        "category": appeal.category,
        "old_status": old_status,
        "new_status": appeal.status,
        "assigned_to": str(appeal.assigned_to) if appeal.assigned_to else None,
        "branch_id": str(appeal.branch_id) if appeal.branch_id else None,
    })

    return appeal
