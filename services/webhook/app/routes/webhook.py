import json
import logging

import aio_pika
from fastapi import APIRouter, Request, Response

from app.providers.wazzup import extract_incoming_messages, is_valid_webhook, verify_webhook_signature
from shared.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["webhook"])

DEDUP_TTL = 300  # 5 minutes — ignore duplicate messageId within this window


async def _get_exchange(request: Request) -> aio_pika.abc.AbstractExchange:
    """Get or create a cached RabbitMQ exchange to avoid per-request channel overhead."""
    exchange = getattr(request.app.state, "rabbit_exchange", None)
    if exchange is None:
        conn = request.app.state.rabbit_connection
        channel = await conn.channel()
        exchange = await channel.declare_exchange(
            "appeals", aio_pika.ExchangeType.TOPIC, durable=True
        )
        request.app.state.rabbit_exchange = exchange
    return exchange


@router.post("/wazzup")
async def wazzup_webhook(request: Request):
    """
    Receive incoming Wazzup webhooks.
    Validates signature, deduplicates messages, extracts text messages,
    and publishes them to RabbitMQ for the bot service.
    """
    body = await request.body()
    settings = get_settings()

    # Verify webhook signature
    signature = request.headers.get("X-Signature")
    if not verify_webhook_signature(body, signature, settings.wazzup_webhook_secret):
        logger.warning("Webhook signature verification failed")
        return Response(status_code=401)

    payload = json.loads(body)
    logger.info("Wazzup webhook received: %s", json.dumps(payload, default=str)[:500])

    if not is_valid_webhook(payload):
        logger.warning("Invalid webhook payload received")
        return Response(status_code=400)

    messages = extract_incoming_messages(payload)
    if not messages:
        logger.debug("No actionable messages in webhook")
        return {"ok": True, "processed": 0}

    # Deduplicate: skip messages already seen (by messageId)
    redis = request.app.state.redis
    unique_messages = []
    for msg in messages:
        if msg.message_id:
            dedup_key = f"webhook:dedup:{msg.message_id}"
            was_set = await redis.set(dedup_key, "1", ex=DEDUP_TTL, nx=True)
            if not was_set:
                logger.info("Duplicate message skipped: %s", msg.message_id)
                continue
        unique_messages.append(msg)

    if not unique_messages:
        return {"ok": True, "processed": 0}

    # Rebuild payload with only unique messages for the bot
    deduped_payload = {**payload, "messages": [
        m for m in payload.get("messages", [])
        if any(m.get("messageId") == um.message_id or m.get("chatId") == um.chat_id
               for um in unique_messages)
    ]}

    exchange = await _get_exchange(request)
    body_bytes = json.dumps(deduped_payload, default=str).encode("utf-8")
    await exchange.publish(
        aio_pika.Message(
            body_bytes,
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        ),
        routing_key="incoming.whatsapp",
    )
    logger.info("Published %d message(s) to RabbitMQ", len(unique_messages))

    return {"ok": True, "processed": len(unique_messages)}


@router.post("/1433")
async def phone_1433_webhook(request: Request):
    """
    Receive incoming appeals from the 1433 phone line.
    Format TBD — placeholder for future integration.
    """
    payload = await request.json()
    logger.info("1433 webhook received: %s", json.dumps(payload, default=str)[:500])

    exchange = await _get_exchange(request)
    body = json.dumps(payload, default=str).encode("utf-8")
    await exchange.publish(
        aio_pika.Message(
            body,
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        ),
        routing_key="incoming.phone",
    )

    return {"ok": True}
