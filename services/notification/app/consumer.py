"""
RabbitMQ consumer for CRM events.
Listens for appeal.created / appeal.updated events and pushes
real-time notifications to connected WebSocket clients.
"""
import json
import logging

import aio_pika
import httpx
from aio_pika.abc import AbstractIncomingMessage

from app.connections import manager

logger = logging.getLogger(__name__)

AUTH_SERVICE_URL = "http://auth:8007"


async def _get_branch_user_ids(branch_id: str) -> list[str]:
    """Fetch user IDs for a branch from the auth service."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{AUTH_SERVICE_URL}/users", params={"branch_id": branch_id})
            resp.raise_for_status()
            return [u["id"] for u in resp.json()]
    except Exception:
        logger.exception("Failed to fetch branch users for %s", branch_id)
        return []


async def start_event_consumer(rabbit_url: str) -> aio_pika.abc.AbstractConnection:
    connection = await aio_pika.connect_robust(rabbit_url)
    channel = await connection.channel()
    await channel.set_qos(prefetch_count=20)

    exchange = await channel.declare_exchange(
        "crm_events", aio_pika.ExchangeType.TOPIC, durable=True
    )

    queue = await channel.declare_queue("notifications.crm", durable=True)
    await queue.bind(exchange, routing_key="appeal.*")

    async def on_event(message: AbstractIncomingMessage) -> None:
        async with message.process():
            try:
                payload = json.loads(message.body)
                event_type = message.routing_key
                logger.info("CRM event: %s — %s", event_type, json.dumps(payload, default=str)[:200])

                notification = {
                    "type": event_type,
                    "data": payload,
                }

                branch_id = payload.get("branch_id")
                assigned_to = payload.get("assigned_to")

                if assigned_to:
                    # Notify the assigned operator directly
                    await manager.send_to_user(assigned_to, notification)
                elif branch_id:
                    # Notify all operators in the branch
                    branch_users = await _get_branch_user_ids(branch_id)
                    if branch_users:
                        await manager.broadcast_to_branch(branch_id, notification, branch_users)
                    else:
                        # Fallback: broadcast to all if branch lookup fails
                        await manager.broadcast(notification)
                else:
                    # No branch info — broadcast to all (e.g., unrouted appeals)
                    await manager.broadcast(notification)

            except Exception:
                logger.exception("Error processing CRM event")

    await queue.consume(on_event)
    logger.info("Notification consumer started, listening for CRM events...")
    return connection
