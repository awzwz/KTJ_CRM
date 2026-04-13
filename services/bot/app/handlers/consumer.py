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
import re
from collections import OrderedDict
from collections.abc import Callable
from datetime import date, datetime

import aio_pika
import httpx
from aio_pika.abc import AbstractIncomingMessage

from app.flows.engine import SmartBotEngine
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
        _http_client = httpx.AsyncClient(
            timeout=15.0,
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
        )
    return _http_client


async def _close_http_client() -> None:
    global _http_client
    if _http_client and not _http_client.is_closed:
        await _http_client.aclose()
        _http_client = None


UNSUPPORTED_MEDIA_RESPONSES = {
    "ru": "Извините, я могу обрабатывать только текстовые и голосовые сообщения. Пожалуйста, опишите вашу ситуацию текстом или голосовым.",
    "kz": "Кешіріңіз, мен тек мәтіндік және дауыстық хабарламаларды өңдей аламын. Жағдайыңызды мәтін немесе дауыстық хабарлама арқылы сипаттаңыз.",
    "en": "Sorry, I can only process text and voice messages. Please describe your situation via text or voice message.",
}

VOICE_FAIL_RESPONSES = {
    "ru": "Извините, не удалось распознать голосовое сообщение. Пожалуйста, попробуйте отправить текстом.",
    "kz": "Кешіріңіз, дауыстық хабарламаны тану мүмкін болмады. Мәтін арқылы жіберіп көріңіз.",
    "en": "Sorry, I couldn't recognize your voice message. Please try sending it as text.",
}


async def _call_transcribe(audio_url: str) -> str | None:
    """Call LLM service to transcribe audio via Whisper."""
    try:
        client = _get_http_client()
        resp = await client.post(
            f"{LLM_SERVICE_URL}/llm/transcribe",
            json={"audio_url": audio_url},
            timeout=45.0,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("text") if data.get("success") else None
    except Exception:
        logger.exception("Transcribe call failed")
        return None


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


_VALID_LANGUAGES = {"ru", "kz"}
_VALID_CATEGORIES = {"complaint", "gratitude", "lost_items", "ticket_return", "suggestion"}
_VALID_SUBCATEGORIES = {
    "train_crew", "ticket_cashier", "other_gratitude",
    "return_status", "return_consultation",
}
_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _sanitize_event_date(raw) -> str | None:
    """Ensure event_date is ISO format (YYYY-MM-DD) or discard it."""
    if raw is None:
        return None
    if isinstance(raw, date):
        return raw.isoformat()
    s = str(raw).strip()
    if _ISO_DATE_RE.match(s):
        try:
            datetime.strptime(s, "%Y-%m-%d")
            return s
        except ValueError:
            return None
    return None


async def create_appeal_in_crm(data: dict) -> None:
    """
    Build a full appeal payload enriched with LLM classification
    and routing data, then create it in CRM.

    LLM classify, LLM response, and routing run in PARALLEL
    to minimize latency (~15s instead of ~70s sequential).
    """
    category = data.get("category", "complaint")
    if category not in _VALID_CATEGORIES:
        logger.warning("Invalid category '%s' from bot, falling back to 'complaint'", category)
        category = "complaint"
    subcategory = data.get("subcategory")
    if subcategory and subcategory not in _VALID_SUBCATEGORIES:
        logger.warning("Invalid subcategory '%s', discarding", subcategory)
        subcategory = None
    train_number = data.get("train_number")
    language = data.get("language", "ru")
    if language not in _VALID_LANGUAGES:
        language = "ru"
    client_message = data.get("client_message", "")

    if data.get("bot_classified"):
        llm_result = None
        auto_response, routing_result = await asyncio.gather(
            _call_llm_response(client_message, category, language),
            _call_routing(category, subcategory, train_number),
        )
    else:
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
    elif data.get("bot_classified"):
        llm_category = category
        llm_confidence = data.get("confidence")

    branch_id = None
    if routing_result:
        branch_id = routing_result.get("branch_id")

    # Build CRM payload
    payload = {
        "category": category,
        "subcategory": subcategory,
        "source": "whatsapp",
        "train_number": train_number,
        "event_date": _sanitize_event_date(data.get("event_date")),
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
            "person_name": data.get("person_name"),
            "full_name": data.get("full_name"),
            "smart_bot_confidence": data.get("confidence"),
            "smart_bot_summary": data.get("summary"),
            "conversation_history": data.get("conversation_history"),
        },
    }
    payload = {k: v for k, v in payload.items() if v is not None}

    try:
        client = _get_http_client()
        response = await client.post(f"{CRM_SERVICE_URL}/appeals", json=payload)
        if response.status_code >= 400:
            logger.error(
                "CRM rejected appeal (status=%s): %s | payload keys: %s",
                response.status_code, response.text[:500],
                list(payload.keys()),
            )
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
        if llm_category:
            update_payload["llm_category"] = llm_category
        if llm_confidence is not None:
            update_payload["llm_confidence"] = llm_confidence

        if update_payload:
            await client.patch(
                f"{CRM_SERVICE_URL}/appeals/{appeal_id}",
                json=update_payload,
            )
            logger.info("Appeal %s updated with LLM response and branch", appeal_id)

    except Exception:
        logger.exception("Failed to create/update appeal in CRM")


DEBOUNCE_SECONDS = 3

WHITELIST_PHONES: set[str] | None = {"87052817121", "77052817121", "87018090200", "77018090200"}


async def start_consumer(
    rabbit_url: str,
) -> tuple[aio_pika.abc.AbstractConnection, "Callable"]:
    """
    Connect to RabbitMQ, bind to the 'appeals' exchange,
    and start consuming incoming.whatsapp messages.

    Uses a debounce mechanism: when multiple messages arrive from the same
    phone within DEBOUNCE_SECONDS, they are buffered and processed together
    as a single combined message.
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
    engine = SmartBotEngine(session_manager)
    wazzup = WazzupClient()

    MAX_PHONE_LOCKS = 1000
    _phone_locks: OrderedDict[str, asyncio.Lock] = OrderedDict()
    _pending_tasks: dict[str, asyncio.Task] = {}
    _channel_map: dict[str, tuple[str, str]] = {}

    async def _debounced_process(phone: str) -> None:
        """Wait for the debounce window, then process all buffered messages."""
        await asyncio.sleep(DEBOUNCE_SECONDS)

        _pending_tasks.pop(phone, None)
        chat_id, channel_id = _channel_map.pop(phone, ("", ""))

        redis = session_manager.redis
        buf_key = f"bot:buffer:{phone}"
        raw_texts = await redis.lrange(buf_key, 0, -1)
        await redis.delete(buf_key)

        if not raw_texts:
            return

        combined = "\n".join(
            t.decode() if isinstance(t, bytes) else t for t in raw_texts
        ).strip()
        if not combined:
            return

        logger.info("Debounced %d message(s) for %s", len(raw_texts), phone)

        if phone not in _phone_locks:
            if len(_phone_locks) >= MAX_PHONE_LOCKS:
                _phone_locks.popitem(last=False)
            _phone_locks[phone] = asyncio.Lock()
        else:
            _phone_locks.move_to_end(phone)

        async with _phone_locks[phone]:
            try:
                responses = await engine.process_message(phone, combined)

                if responses and channel_id:
                    await wazzup.send_messages(chat_id, channel_id, responses)

                completed_data = await engine.get_completed_data(phone)
                if completed_data:
                    await create_appeal_in_crm(completed_data)
            except Exception:
                logger.exception("Error in debounced processing for %s", phone)

    async def on_message(message: AbstractIncomingMessage) -> None:
        async with message.process():
            try:
                payload = json.loads(message.body)
                logger.info("Received message: %s", json.dumps(payload, default=str)[:300])

                messages_list = payload.get("messages", [])
                if not messages_list:
                    return

                for msg in messages_list:
                    chat_id = msg.get("chat_id") or msg.get("chatId", "")
                    channel_id = msg.get("channel_id") or msg.get("channelId", "")
                    text = msg.get("text", "")
                    media_type = msg.get("media_type")
                    content_url = msg.get("content_url")

                    if not chat_id:
                        continue

                    phone = chat_id

                    if WHITELIST_PHONES is not None:
                        normalized = phone.lstrip("+").replace(" ", "")
                        if not any(normalized.endswith(w) for w in WHITELIST_PHONES):
                            logger.info("Ignoring message from %s (not in whitelist)", phone)
                            continue

                    if media_type in ("audio", "voice") and content_url:
                        transcribed = await _call_transcribe(content_url)
                        if transcribed:
                            text = transcribed
                        else:
                            if channel_id:
                                session = await session_manager.get(phone)
                                lang = (session.get("language") if session else None) or "ru"
                                await wazzup.send_message(
                                    chat_id, channel_id,
                                    VOICE_FAIL_RESPONSES.get(lang, VOICE_FAIL_RESPONSES["ru"]),
                                )
                            continue
                    elif media_type and not text:
                        if channel_id:
                            media_cooldown_key = f"bot:media_hint:{phone}"
                            if not await session_manager.redis.get(media_cooldown_key):
                                session = await session_manager.get(phone)
                                lang = (session.get("language") if session else None) or "ru"
                                await wazzup.send_message(
                                    chat_id, channel_id,
                                    UNSUPPORTED_MEDIA_RESPONSES.get(lang, UNSUPPORTED_MEDIA_RESPONSES["ru"]),
                                )
                                await session_manager.redis.set(media_cooldown_key, "1", ex=60)
                        continue

                    if not text:
                        continue

                    buf_key = f"bot:buffer:{phone}"
                    await session_manager.redis.rpush(buf_key, text)
                    await session_manager.redis.expire(buf_key, 30)

                    _channel_map[phone] = (chat_id, channel_id)

                    old_task = _pending_tasks.get(phone)
                    if old_task and not old_task.done():
                        old_task.cancel()

                    _pending_tasks[phone] = asyncio.create_task(
                        _debounced_process(phone)
                    )

            except Exception:
                logger.exception("Error processing message")

    await queue.consume(on_message)
    logger.info("Bot consumer started, waiting for messages...")

    async def cleanup() -> None:
        await engine.close()
        await wazzup.close()
        await session_manager.close()
        await _close_http_client()

    return connection, cleanup
