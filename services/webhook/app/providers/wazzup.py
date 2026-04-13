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
    media_type: str | None = None
    content_url: str | None = None


MEDIA_TYPES = {"image", "video", "audio", "voice", "document", "sticker", "file"}


def extract_incoming_messages(payload: dict) -> list[NormalizedMessage]:
    """
    Extract and normalize incoming messages from a Wazzup webhook payload.
    Handles text messages and media messages (audio, image, video, etc.).
    Filters out status updates, delivery reports, and echo messages.
    """
    messages = []

    raw_messages = payload.get("messages", [])

    for msg in raw_messages:
        if msg.get("isEcho"):
            logger.debug("Skipping echo message: %s", msg.get("messageId"))
            continue

        msg_type = msg.get("type", "")
        chat_id = msg.get("chatId", "")
        channel_id = msg.get("channelId", "")
        message_id = msg.get("messageId")
        content_url = msg.get("contentUri") or msg.get("content")

        if not chat_id:
            continue

        if msg_type == "text" or ("text" in msg and msg_type not in MEDIA_TYPES):
            text = msg.get("text", "").strip()
            if not text:
                logger.debug("Skipping message with empty text: %s", msg)
                continue
            messages.append(NormalizedMessage(
                chat_id=chat_id, channel_id=channel_id,
                text=text, message_id=message_id,
            ))
        elif msg_type in MEDIA_TYPES:
            logger.info("Media message: type=%s, contentUri=%s", msg_type, bool(content_url))
            messages.append(NormalizedMessage(
                chat_id=chat_id, channel_id=channel_id,
                text="", message_id=message_id,
                media_type=msg_type, content_url=content_url,
            ))

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
        logger.warning(
            "WAZZUP_WEBHOOK_SECRET is not set — signature verification is DISABLED. "
            "Anyone can send fake webhooks. Set the secret before going to production."
        )
        return True
    if not signature:
        return False
    import hmac
    import hashlib
    computed = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, signature)
