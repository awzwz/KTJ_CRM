"""
Routing rules engine.
Determines which branch and shift an appeal should be assigned to
based on category, subcategory, train number, and time of day.
"""
import logging
from datetime import datetime, timezone, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models.branch import Branch

logger = logging.getLogger(__name__)

# UTC+6 for Kazakhstan
KZ_TZ = timezone(timedelta(hours=6))

# Mapping of train number ranges to branch codes.
# In production this would be a DB table; hardcoded for MVP.
TRAIN_BRANCH_MAP: list[tuple[range, str]] = [
    (range(1, 100), "ALMATY"),
    (range(100, 200), "ASTANA"),
    (range(200, 300), "KARAGANDA"),
    (range(300, 400), "SHYMKENT"),
    (range(400, 500), "AKTOBE"),
    (range(500, 600), "PAVLODAR"),
    (range(600, 700), "KOSTANAY"),
    (range(700, 800), "ATYRAU"),
    (range(800, 900), "SEMEY"),
    (range(900, 1000), "MANGYSTAU"),
]

GP_CA_CODE = "GP_CA"


def get_current_shift() -> str | None:
    """
    Determine the active ticket-return shift based on Kazakhstan time.
    ЛВРС: 08:00–12:00
    ЛВРЗ: 12:00–16:00
    ЛВРНО: 18:00–20:00
    """
    now = datetime.now(KZ_TZ)
    hour = now.hour

    if 8 <= hour < 12:
        return "lvrs"
    elif 12 <= hour < 16:
        return "lvrz"
    elif 18 <= hour < 20:
        return "lvrno"
    return None


def get_branch_code_by_train(train_number: int | None) -> str | None:
    """Find the branch code responsible for a given train number."""
    if train_number is None:
        return None
    for num_range, code in TRAIN_BRANCH_MAP:
        if train_number in num_range:
            return code
    return None


class RoutingEngine:
    """Determines the target branch for an appeal."""

    async def route(
        self,
        db: AsyncSession,
        category: str,
        subcategory: str | None = None,
        train_number: int | None = None,
    ) -> dict:
        """
        Route an appeal and return routing info:
        {
            "branch_id": UUID | None,
            "branch_code": str | None,
            "branch_name": str | None,
            "shift": str | None,
            "routing_reason": str
        }
        """
        # Suggestions and "other" gratitude -> ГП ЦА
        if category == "suggestion":
            return await self._resolve_branch(db, GP_CA_CODE, reason="Предложения -> ГП ЦА")

        if category == "gratitude" and subcategory == "other_gratitude":
            return await self._resolve_branch(db, GP_CA_CODE, reason="Благодарность (другие) -> ГП ЦА")

        # Ticket return -> time-based shift routing
        if category == "ticket_return":
            shift = get_current_shift()
            branch_code = get_branch_code_by_train(train_number)
            result = await self._resolve_branch(
                db, branch_code,
                reason=f"Возврат билета -> смена {shift or 'нет активной'}, поезд {train_number}"
            )
            result["shift"] = shift
            return result

        # Gratitude (train_crew, cashier), lost items, complaint -> branch by train
        branch_code = get_branch_code_by_train(train_number)
        if branch_code:
            return await self._resolve_branch(
                db, branch_code,
                reason=f"Категория {category} -> филиал по поезду #{train_number}"
            )

        # Fallback -> ГП ЦА
        return await self._resolve_branch(
            db, GP_CA_CODE,
            reason=f"Не удалось определить филиал для поезда #{train_number}, направлено в ГП ЦА"
        )

    async def _resolve_branch(
        self, db: AsyncSession, code: str | None, reason: str
    ) -> dict:
        """Look up branch in DB by code."""
        result = {
            "branch_id": None,
            "branch_code": code,
            "branch_name": None,
            "shift": None,
            "routing_reason": reason,
        }

        if code is None:
            return result

        query = select(Branch).where(Branch.code == code, Branch.is_active.is_(True))
        db_result = await db.execute(query)
        branch = db_result.scalar_one_or_none()

        if branch:
            result["branch_id"] = str(branch.id)
            result["branch_name"] = branch.name
            logger.info("Routed to branch %s (%s): %s", branch.name, code, reason)
        else:
            logger.warning("Branch code '%s' not found in DB: %s", code, reason)

        return result
