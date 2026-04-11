"""
RabbitMQ consumer — listens for incoming WhatsApp messages
published by the webhook service, processes them through the bot engine,
sends responses back via Wazzup, and creates CRM appeals on completion.

On completion, also calls:
- LLM service for classification verification and LLM-generated response
- Routing service to determine the target branch
"""
import asyncio
import json
import logging

import aio_pika
import httpx
from aio_pika.abc import AbstractIncomingMessage

from app.flows.engine import BotEngine
from app.flows.session import SessionManager
from app.flows.wazzup_client import WazzupClient
from shared.config import get_settings

logger = logging.getLogger(__name__)

CRM_SERVICE_URL = "http://crm:8004"
LLM_SERVICE_URL = "http://llm:8003"
ROUTING_SERVICE_URL = "http://routing:8005"

# Singleton HTTP client — reused across all calls to avoid per-request TCP overhead
_http_client: httpx.AsyncClient | None = None


def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=15.0)
    return _http_client


async def _call_llm_classify(text: str, language: str) -> dict | None:
    """Call LLM service to classify the appeal text."""
    try:
        client = _get_http_client()
        resp = await client.post(
            f"{LLM_SERVICE_URL}/llm/classify",
            json={"text": text, "language": language},
        )
        resp.raise_for_status()
        return resp.json()
    except Exception:
        logger.exception("LLM classify call failed")
        return None


async def _call_llm_response(text: str, category: str, language: str) -> str | None:
    """Call LLM service to generate an auto-response."""
    try:
        client = _get_http_client()
        resp = await client.post(
            f"{LLM_SERVICE_URL}/llm/generate-response",
            json={"text": text, "category": category, "language": language},
        )
        resp.raise_for_status()
        return resp.json().get("response")
    except Exception:
        logger.exception("LLM generate-response call failed")
        return None


async def _call_routing(category: str, subcategory: str | None, train_number: int | None) -> dict | None:
    """Call routing service to determine the target branch."""
    try:
        client = _get_http_client()
        resp = await client.post(
            f"{ROUTING_SERVICE_URL}/routing/route-appeal",
            json={
                "category": category,
                "subcategory": subcategory,
                "train_number": train_number,
            },
        )
        resp.raise_for_status()
        return resp.json()
    except Exception:
        logger.exception("Routing call failed")
        return None


async def create_appeal_in_crm(data: dict) -> None:
    """
    Build a full appeal payload enriched with LLM classification
    and routing data, then create it in CRM.

    LLM classify, LLM response, and routing run in PARALLEL
    to minimize latency (~15s instead of ~70s sequential).
    """
    category = data.get("category", "complaint")
    subcategory = data.get("subcategory")
    train_number = data.get("train_number")
    language = data.get("language", "ru")
    client_message = data.get("client_message", "")

    # Run all three enrichment calls in parallel
    llm_result, auto_response, routing_result = await asyncio.gather(
        _call_llm_classify(client_message, language),
        _call_llm_response(client_message, category, language),
        _call_routing(category, subcategory, train_number),
    )

    llm_category = None
    llm_confidence = None
    if llm_result:
        llm_category = llm_result.get("category")
        llm_confidence = llm_result.get("confidence")

    branch_id = None
    if routing_result:
        branch_id = routing_result.get("branch_id")

    # Build CRM payload
    payload = {
        "category": category,
        "subcategory": subcategory,
        "source": "whatsapp",
        "train_number": train_number,
        "event_date": data.get("event_date"),
        "language": language,
        "client_phone": data.get("phone"),
        "client_message": client_message,
        "car_number": data.get("car_number"),
        "seat_number": data.get("seat_number"),
        "station_name": data.get("station_name"),
        "cashier_name": data.get("cashier_name"),
        "item_description": data.get("item_description"),
        "ticket_number": data.get("ticket_number"),
        "metadata_json": {
            "llm_category": llm_category,
            "llm_confidence": llm_confidence,
            "llm_summary": llm_result.get("summary") if llm_result else None,
            "llm_available": llm_result is not None,
            "routing_reason": routing_result.get("routing_reason") if routing_result else None,
            "shift": routing_result.get("shift") if routing_result else None,
        },
    }
    payload = {k: v for k, v in payload.items() if v is not None}

    try:
        client = _get_http_client()
        response = await client.post(f"{CRM_SERVICE_URL}/appeals", json=payload)
        response.raise_for_status()
        appeal = response.json()
        appeal_id = appeal["id"]
        logger.info("Appeal created: %s (category=%s, branch=%s)", appeal_id, category, branch_id)

        # Update appeal with LLM fields and branch assignment
        update_payload = {}
        if auto_response:
            update_payload["auto_response"] = auto_response
        if branch_id:
            update_payload["branch_id"] = branch_id

        if update_payload:
            await client.patch(
                f"{CRM_SERVICE_URL}/appeals/{appeal_id}",
                json=update_payload,
            )
            logger.info("Appeal %s updated with LLM response and branch", appeal_id)

    except Exception:
        logger.exception("Failed to create/update appeal in CRM")


async def start_consumer(rabbit_url: str) -> aio_pika.abc.AbstractConnection:
    """
    Connect to RabbitMQ, bind to the 'appeals' exchange,
    and start consuming incoming.whatsapp messages.
    """
    connection = await aio_pika.connect_robust(rabbit_url)
    channel = await connection.channel()
    await channel.set_qos(prefetch_count=10)

    exchange = await channel.declare_exchange(
        "appeals", aio_pika.ExchangeType.TOPIC, durable=True
    )
    queue = await channel.declare_queue("bot.incoming.whatsapp", durable=True)
    await queue.bind(exchange, routing_key="incoming.whatsapp")

    session_manager = SessionManager()
    engine = BotEngine(session_manager)
    wazzup = WazzupClient()

    # Per-phone lock to prevent race conditions on concurrent messages
    _phone_locks: dict[str, asyncio.Lock] = {}

    async def on_message(message: AbstractIncomingMessage) -> None:
        async with message.process():
            try:
                payload = json.loads(message.body)
                logger.info("Received message: %s", json.dumps(payload, default=str)[:300])

                messages_list = payload.get("messages", [])
                if not messages_list:
                    return

                for msg in messages_list:
                    chat_id = msg.get("chatId", "")
                    channel_id = msg.get("channelId", "")
                    text = msg.get("text", "")

                    if not chat_id or not text:
                        continue

                    phone = chat_id

                    # Acquire per-phone lock to ensure sequential processing
                    if phone not in _phone_locks:
                        _phone_locks[phone] = asyncio.Lock()

                    async with _phone_locks[phone]:
                        responses = await engine.process_message(phone, text)

                        if responses and channel_id:
                            await wazzup.send_messages(chat_id, channel_id, responses)

                        completed_data = await engine.get_completed_data(phone)
                        if completed_data:
                            await create_appeal_in_crm(completed_data)

            except Exception:
                logger.exception("Error processing message")

    await queue.consume(on_message)
    logger.info("Bot consumer started, waiting for messages...")
    return connection
