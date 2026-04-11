"""
Session manager — stores conversation state in Redis.
Each WhatsApp phone number has one active session.
"""
import json
import logging
from datetime import datetime

import redis.asyncio as redis
from shared.config import get_settings

logger = logging.getLogger(__name__)

SESSION_TTL = 24 * 60 * 60  # 24 hours


def _key(phone: str) -> str:
    return f"bot:session:{phone}"


class SessionManager:
    def __init__(self):
        settings = get_settings()
        self.redis = redis.from_url(settings.redis_url, decode_responses=True)

    async def get(self, phone: str) -> dict | None:
        raw = await self.redis.get(_key(phone))
        if raw is None:
            return None
        return json.loads(raw)

    async def save(self, phone: str, session: dict) -> None:
        session["updated_at"] = datetime.utcnow().isoformat()
        await self.redis.set(_key(phone), json.dumps(session, default=str), ex=SESSION_TTL)

    async def delete(self, phone: str) -> None:
        await self.redis.delete(_key(phone))

    async def create(self, phone: str) -> dict:
        session = {
            "phone": phone,
            "state": "start",
            "language": "ru",
            "data": {},
            "created_at": datetime.utcnow().isoformat(),
        }
        await self.save(phone, session)
        return session

    async def close(self):
        await self.redis.aclose()
