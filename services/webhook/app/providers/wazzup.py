"""
Wazzup webhook payload normalization and validation.
Wazzup sends different event types — we only care about incoming text messages.
"""
import logging
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class NormalizedMessage(BaseModel):
    chat_id: str
    channel_id: str
    text: str
    message_id: str | None = None
    chat_type: str = "whatsapp"


def extract_incoming_messages(payload: dict) -> list[NormalizedMessage]:
    """
    Extract and normalize incoming text messages from a Wazzup webhook payload.
    Filters out status updates, delivery reports, and non-text messages.
    """
    messages = []

    # Wazzup v3 webhook format
    raw_messages = payload.get("messages", [])

    for msg in raw_messages:
        if msg.get("isEcho"):
            logger.debug("Skipping echo message: %s", msg.get("messageId"))
            continue

        if msg.get("type") == "text" or "text" in msg:
            chat_id = msg.get("chatId", "")
            channel_id = msg.get("channelId", "")
            text = msg.get("text", "").strip()
            message_id = msg.get("messageId")

            if not chat_id or not text:
                logger.debug("Skipping message with missing chatId or text: %s", msg)
                continue

            messages.append(
                NormalizedMessage(
                    chat_id=chat_id,
                    channel_id=channel_id,
                    text=text,
                    message_id=message_id,
                )
            )

    # Handle status updates (ignore them but log)
    statuses = payload.get("statuses", [])
    if statuses:
        logger.debug("Received %d status updates (ignored)", len(statuses))

    return messages


def is_valid_webhook(payload: dict) -> bool:
    """Basic validation that the payload looks like a Wazzup webhook."""
    return isinstance(payload, dict) and (
        "messages" in payload or "statuses" in payload
    )


def verify_webhook_signature(body: bytes, signature: str | None, secret: str) -> bool:
    """Verify Wazzup webhook HMAC-SHA256 signature.

    If no secret is configured (empty string), skip verification
    to allow local development without Wazzup.
    """
    if not secret:
        return True
    if not signature:
        return False
    import hmac
    import hashlib
    computed = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, signature)
