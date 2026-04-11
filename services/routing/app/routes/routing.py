from uuid import UUID

from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from app.rules.engine import RoutingEngine

router = APIRouter(prefix="/routing", tags=["routing"])

engine = RoutingEngine()


class RouteAppealRequest(BaseModel):
    category: str
    subcategory: str | None = None
    train_number: int | None = None


class RouteAppealResponse(BaseModel):
    branch_id: str | None = None
    branch_code: str | None = None
    branch_name: str | None = None
    shift: str | None = None
    routing_reason: str


@router.post("/route-appeal", response_model=RouteAppealResponse)
async def route_appeal(
    body: RouteAppealRequest,
    db: AsyncSession = Depends(get_db),
):
    """Determine the target branch for an appeal based on routing rules."""
    result = await engine.route(
        db,
        category=body.category,
        subcategory=body.subcategory,
        train_number=body.train_number,
    )
    return RouteAppealResponse(**result)
