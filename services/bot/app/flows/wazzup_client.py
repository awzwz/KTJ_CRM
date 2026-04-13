"""
Wazzup24 API client — sends messages back to WhatsApp users.
API docs: https://wazzup24.com/apiDoc
"""
import asyncio
import logging

import httpx
from shared.config import get_settings

logger = logging.getLogger(__name__)

MAX_RETRIES = 2
RETRY_DELAY = 1.0
_RETRYABLE_STATUS_CODES = {429, 500, 502, 503}


class WazzupClient:
    def __init__(self):
        settings = get_settings()
        self.api_url = settings.wazzup_api_url
        self.api_key = settings.wazzup_api_key
        self.client = httpx.AsyncClient(
            base_url=self.api_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    async def send_message(self, chat_id: str, channel_id: str, text: str) -> dict:
        """Send a text message to a WhatsApp user via Wazzup with retry."""
        payload = {
            "channelId": channel_id,
            "chatId": chat_id,
            "chatType": "whatsapp",
            "text": text,
        }

        for attempt in range(MAX_RETRIES + 1):
            try:
                response = await self.client.post("/message", json=payload)
                response.raise_for_status()
                result = response.json()
                logger.info("Message sent to %s: %s", chat_id, result)
                return result
            except httpx.HTTPStatusError as e:
                if e.response.status_code in _RETRYABLE_STATUS_CODES and attempt < MAX_RETRIES:
                    delay = RETRY_DELAY * (attempt + 1)
                    logger.warning(
                        "Wazzup API %d, retrying in %.1fs (attempt %d/%d)",
                        e.response.status_code, delay, attempt + 1, MAX_RETRIES,
                    )
                    await asyncio.sleep(delay)
                    continue
                logger.error("Wazzup API error %d: %s", e.response.status_code, e.response.text)
                return {"error": e.response.status_code, "detail": e.response.text}
            except httpx.RequestError as e:
                if attempt < MAX_RETRIES:
                    delay = RETRY_DELAY * (attempt + 1)
                    logger.warning(
                        "Wazzup request error, retrying in %.1fs (attempt %d/%d): %s",
                        delay, attempt + 1, MAX_RETRIES, e,
                    )
                    await asyncio.sleep(delay)
                    continue
                logger.error("Wazzup request failed: %s", e)
                return {"error": "request_failed", "detail": str(e)}

        return {"error": "max_retries", "detail": "All retries exhausted"}

    async def send_messages(self, chat_id: str, channel_id: str, messages: list[str]) -> None:
        """Send multiple messages sequentially."""
        for msg in messages:
            await self.send_message(chat_id, channel_id, msg)

    async def close(self):
        await self.client.aclose()
