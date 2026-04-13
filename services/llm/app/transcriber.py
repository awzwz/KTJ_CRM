"""
Audio transcriber using OpenAI Whisper API.
Downloads audio files from URLs and converts speech to text.
"""
import io
import logging

import httpx
from openai import AsyncOpenAI

from shared.config import get_settings

logger = logging.getLogger(__name__)

MAX_TRANSCRIBE_RETRIES = 2
MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB — Whisper API limit


class AudioTranscriber:
    def __init__(self):
        settings = get_settings()
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.http = httpx.AsyncClient(timeout=30.0)

    async def transcribe(self, audio_url: str) -> str | None:
        """Download audio from URL and transcribe using OpenAI Whisper.

        Retries up to MAX_TRANSCRIBE_RETRIES times on transient failures.
        Returns None if the file is too large or all attempts fail.
        """
        for attempt in range(MAX_TRANSCRIBE_RETRIES + 1):
            try:
                resp = await self.http.get(audio_url)
                resp.raise_for_status()

                if len(resp.content) > MAX_AUDIO_SIZE_BYTES:
                    logger.warning(
                        "Audio file too large: %d bytes (limit %d). Skipping transcription.",
                        len(resp.content),
                        MAX_AUDIO_SIZE_BYTES,
                    )
                    return None  # No point retrying — file won't shrink

                content_type = resp.headers.get("content-type", "")
                ext = "ogg"
                if "mp3" in content_type:
                    ext = "mp3"
                elif "mp4" in content_type or "m4a" in content_type:
                    ext = "m4a"
                elif "wav" in content_type:
                    ext = "wav"
                elif "webm" in content_type:
                    ext = "webm"

                audio_file = io.BytesIO(resp.content)
                audio_file.name = f"voice.{ext}"

                transcription = await self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                )

                text = transcription.text.strip()
                logger.info(
                    "Transcribed audio (%d bytes): %s",
                    len(resp.content),
                    text[:100],
                )
                return text if text else None

            except Exception:
                if attempt < MAX_TRANSCRIBE_RETRIES:
                    logger.warning(
                        "Transcription attempt %d/%d failed for URL: %s — retrying...",
                        attempt + 1,
                        MAX_TRANSCRIBE_RETRIES,
                        audio_url[:100],
                    )
                else:
                    logger.exception(
                        "Audio transcription failed after %d attempts for URL: %s",
                        MAX_TRANSCRIBE_RETRIES + 1,
                        audio_url[:100],
                    )
        return None

    async def close(self):
        await self.http.aclose()
