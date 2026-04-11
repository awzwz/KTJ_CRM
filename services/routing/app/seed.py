"""
Seed data for branches.
Run once to populate the branches table with KTZh regional branches.
"""
import asyncio
import logging

from sqlalchemy import select
from shared.database import async_session
from shared.models.branch import Branch

logger = logging.getLogger(__name__)

BRANCHES = [
    {"name": "Алматинский филиал", "code": "ALMATY", "branch_type": "regional"},
    {"name": "Астанинский филиал", "code": "ASTANA", "branch_type": "regional"},
    {"name": "Карагандинский филиал", "code": "KARAGANDA", "branch_type": "regional"},
    {"name": "Шымкентский филиал", "code": "SHYMKENT", "branch_type": "regional"},
    {"name": "Актюбинский филиал", "code": "AKTOBE", "branch_type": "regional"},
    {"name": "Павлодарский филиал", "code": "PAVLODAR", "branch_type": "regional"},
    {"name": "Костанайский филиал", "code": "KOSTANAY", "branch_type": "regional"},
    {"name": "Атырауский филиал", "code": "ATYRAU", "branch_type": "regional"},
    {"name": "Семейский филиал", "code": "SEMEY", "branch_type": "regional"},
    {"name": "Мангыстауский филиал", "code": "MANGYSTAU", "branch_type": "regional"},
    {"name": "ГП Центральный аппарат", "code": "GP_CA", "branch_type": "central"},
]


async def seed_branches():
    async with async_session() as db:
        for branch_data in BRANCHES:
            result = await db.execute(
                select(Branch).where(Branch.code == branch_data["code"])
            )
            existing = result.scalar_one_or_none()
            if existing is None:
                db.add(Branch(**branch_data))
                logger.info("Created branch: %s", branch_data["name"])
            else:
                logger.info("Branch already exists: %s", branch_data["name"])
        await db.commit()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed_branches())
