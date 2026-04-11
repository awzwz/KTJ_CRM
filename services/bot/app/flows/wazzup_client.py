"""
Wazzup24 API client — sends messages back to WhatsApp users.
API docs: https://wazzup24.com/apiDoc
"""
import logging

import httpx
from shared.config import get_settings

logger = logging.getLogger(__name__)


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
        """Send a text message to a WhatsApp user via Wazzup."""
        payload = {
            "channelId": channel_id,
            "chatId": chat_id,
            "chatType": "whatsapp",
            "text": text,
        }

        try:
            response = await self.client.post("/message", json=payload)
            response.raise_for_status()
            result = response.json()
            logger.info("Message sent to %s: %s", chat_id, result)
            return result
        except httpx.HTTPStatusError as e:
            logger.error("Wazzup API error %d: %s", e.response.status_code, e.response.text)
            return {"error": e.response.status_code, "detail": e.response.text}
        except httpx.RequestError as e:
            logger.error("Wazzup request failed: %s", e)
            return {"error": "request_failed", "detail": str(e)}

    async def send_messages(self, chat_id: str, channel_id: str, messages: list[str]) -> None:
        """Send multiple messages sequentially."""
        for msg in messages:
            await self.send_message(chat_id, channel_id, msg)

    async def close(self):
        await self.client.aclose()
