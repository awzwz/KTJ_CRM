from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def dashboard_summary(db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, Any]:
    by_status: dict[str, int] = {}
    r_status = await db.execute(
        text("SELECT status, COUNT(*)::int AS cnt FROM appeals GROUP BY status ORDER BY status")
    )
    for row in r_status.mappings():
        by_status[row["status"]] = row["cnt"]

    by_category: dict[str, int] = {}
    r_cat = await db.execute(
        text("SELECT category, COUNT(*)::int AS cnt FROM appeals GROUP BY category ORDER BY category")
    )
    for row in r_cat.mappings():
        by_category[row["category"]] = row["cnt"]

    return {"by_status": by_status, "by_category": by_category}


@router.get("/kpi")
async def dashboard_kpi(db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, Any]:
    r = await db.execute(
        text("""
            SELECT
                COUNT(*)::int AS total_appeals,
                COUNT(*) FILTER (WHERE status IN ('resolved', 'closed'))::int AS resolved_count,
                COUNT(*) FILTER (WHERE status = 'new')::int AS new_count,
                COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress_count,
                AVG(
                    EXTRACT(EPOCH FROM (first_response_at - created_at))
                ) FILTER (WHERE first_response_at IS NOT NULL) AS avg_response_seconds,
                AVG(
                    EXTRACT(EPOCH FROM (resolved_at - created_at))
                ) FILTER (WHERE resolved_at IS NOT NULL) AS avg_resolution_seconds
            FROM appeals
        """)
    )
    row = r.mappings().first()
    if row is None:
        return {
            "total_appeals": 0, "resolved_count": 0, "new_count": 0,
            "in_progress_count": 0,
            "avg_response_time_seconds": None, "avg_resolution_time_seconds": None,
        }

    return {
        "total_appeals": row["total_appeals"],
        "resolved_count": row["resolved_count"],
        "new_count": row["new_count"],
        "in_progress_count": row["in_progress_count"],
        "avg_response_time_seconds": float(row["avg_response_seconds"]) if row["avg_response_seconds"] else None,
        "avg_resolution_time_seconds": float(row["avg_resolution_seconds"]) if row["avg_resolution_seconds"] else None,
    }


@router.get("/top-trains")
async def top_trains(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(10, ge=1, le=50),
    category: str | None = None,
) -> list[dict[str, Any]]:
    """Top trains by number of appeals (complaints by default)."""
    q = """
        SELECT
            train_number,
            COUNT(*)::int AS appeal_count,
            COUNT(*) FILTER (WHERE category = 'complaint')::int AS complaint_count,
            COUNT(*) FILTER (WHERE category = 'gratitude')::int AS gratitude_count
        FROM appeals
        WHERE train_number IS NOT NULL
    """
    params: dict[str, Any] = {"lim": limit}
    if category:
        q += " AND category = :cat"
        params["cat"] = category
    q += " GROUP BY train_number ORDER BY appeal_count DESC LIMIT :lim"

    result = await db.execute(text(q), params)
    return [dict(row) for row in result.mappings().all()]


@router.get("/by-branch")
async def appeals_by_branch(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict[str, Any]]:
    """Appeal counts grouped by branch."""
    result = await db.execute(text("""
        SELECT
            b.name AS branch_name,
            b.code AS branch_code,
            COUNT(a.id)::int AS total,
            COUNT(a.id) FILTER (WHERE a.status = 'new')::int AS new_count,
            COUNT(a.id) FILTER (WHERE a.status = 'in_progress')::int AS in_progress_count,
            COUNT(a.id) FILTER (WHERE a.status IN ('resolved', 'closed'))::int AS resolved_count
        FROM branches b
        LEFT JOIN appeals a ON a.branch_id = b.id
        WHERE b.is_active = true
        GROUP BY b.id, b.name, b.code
        ORDER BY total DESC
    """))
    return [dict(row) for row in result.mappings().all()]


@router.get("/by-source")
async def appeals_by_source(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict[str, Any]]:
    """Appeal counts grouped by source (whatsapp / phone_1433)."""
    result = await db.execute(text("""
        SELECT source, COUNT(*)::int AS count
        FROM appeals
        GROUP BY source ORDER BY count DESC
    """))
    return [dict(row) for row in result.mappings().all()]


@router.get("/operator-performance")
async def operator_performance(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(20, ge=1, le=100),
) -> list[dict[str, Any]]:
    """KPI per operator: assigned appeals, resolved, avg response time."""
    result = await db.execute(text("""
        SELECT
            u.id AS operator_id,
            u.full_name,
            u.role,
            COUNT(a.id)::int AS assigned_total,
            COUNT(a.id) FILTER (WHERE a.status IN ('resolved', 'closed'))::int AS resolved_count,
            AVG(
                EXTRACT(EPOCH FROM (a.first_response_at - a.created_at))
            ) FILTER (WHERE a.first_response_at IS NOT NULL) AS avg_response_seconds
        FROM users u
        LEFT JOIN appeals a ON a.assigned_to = u.id
        WHERE u.is_active = true AND u.role IN ('operator', 'controller', 'branch_manager')
        GROUP BY u.id, u.full_name, u.role
        ORDER BY assigned_total DESC
        LIMIT :lim
    """), {"lim": limit})
    rows = []
    for row in result.mappings().all():
        d = dict(row)
        d["operator_id"] = str(d["operator_id"])
        if d["avg_response_seconds"] is not None:
            d["avg_response_seconds"] = float(d["avg_response_seconds"])
        rows.append(d)
    return rows


@router.get("/timeline")
async def appeals_timeline(
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(30, ge=1, le=365),
) -> list[dict[str, Any]]:
    """Daily appeal count for the last N days."""
    result = await db.execute(text("""
        SELECT
            DATE(created_at) AS day,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE category = 'complaint')::int AS complaints,
            COUNT(*) FILTER (WHERE category = 'gratitude')::int AS gratitudes
        FROM appeals
        WHERE created_at >= NOW() - MAKE_INTERVAL(days => :d)
        GROUP BY DATE(created_at)
        ORDER BY day
    """), {"d": days})
    rows = []
    for row in result.mappings().all():
        d = dict(row)
        d["day"] = str(d["day"])
        rows.append(d)
    return rows
