"""
Publish CRM events to RabbitMQ for real-time notification fanout.
"""
import json
import logging

import aio_pika

logger = logging.getLogger(__name__)

_connection: aio_pika.abc.AbstractConnection | None = None


async def init_publisher(rabbit_url: str) -> None:
    global _connection
    _connection = await aio_pika.connect_robust(rabbit_url)
    logger.info("CRM event publisher connected to RabbitMQ")


async def close_publisher() -> None:
    global _connection
    if _connection:
        await _connection.close()
        _connection = None


async def publish_event(routing_key: str, data: dict) -> None:
    """Publish an event to the crm_events exchange."""
    if _connection is None:
        logger.warning("RabbitMQ not connected, skipping event: %s", routing_key)
        return

    try:
        channel = await _connection.channel()
        try:
            exchange = await channel.declare_exchange(
                "crm_events", aio_pika.ExchangeType.TOPIC, durable=True
            )
            body = json.dumps(data, default=str).encode("utf-8")
            await exchange.publish(
                aio_pika.Message(
                    body,
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                ),
                routing_key=routing_key,
            )
            logger.info("Published event: %s", routing_key)
        finally:
            await channel.close()
    except Exception:
        logger.exception("Failed to publish event: %s", routing_key)
