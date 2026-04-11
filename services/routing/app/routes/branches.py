from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from shared.models.branch import Branch
from shared.schemas.branch import BranchCreate, BranchRead

router = APIRouter(prefix="/branches", tags=["branches"])


@router.get("", response_model=list[BranchRead])
async def list_branches(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(Branch).order_by(Branch.name))
    return list(result.scalars().all())


@router.post("", response_model=BranchRead, status_code=status.HTTP_201_CREATED)
async def create_branch(
    body: BranchCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    branch = Branch(
        name=body.name,
        code=body.code,
        branch_type=body.branch_type,
    )
    db.add(branch)
    await db.commit()
    await db.refresh(branch)
    return branch


@router.get("/{branch_id}", response_model=BranchRead)
async def get_branch(
    branch_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Branch).where(Branch.id == branch_id))
    branch = result.scalar_one_or_none()
    if branch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")
    return branch
