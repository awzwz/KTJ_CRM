"""
LLM-based appeal classifier.
Uses OpenAI to classify free-text appeals into categories
and extract structured data.
"""
import json
import logging

from openai import AsyncOpenAI
from shared.config import get_settings

logger = logging.getLogger(__name__)

CLASSIFICATION_SYSTEM_PROMPT = """Ты — система классификации обращений клиентов железнодорожной компании КТЖ (Казахстан Темір Жолы).

Твоя задача — проанализировать текст обращения клиента и вернуть JSON с классификацией.

Категории обращений:
- gratitude — благодарность (положительный отзыв о сотруднике или сервисе)
- lost_items — забытые вещи (клиент забыл что-то в поезде)
- ticket_return — возврат билета (вопросы по возврату денег за билет)
- complaint — жалоба (негативный отзыв, проблема, претензия)
- suggestion — предложение (идея по улучшению сервиса)

Подкатегории для благодарности:
- train_crew — работник поездной бригады
- ticket_cashier — билетный кассир
- other_gratitude — другие

Подкатегории для возврата билета:
- return_status — статус возврата
- return_consultation — консультация по возврату

Верни ТОЛЬКО валидный JSON без markdown-форматирования:
{
  "category": "одна из категорий выше",
  "subcategory": "подкатегория или null",
  "confidence": число от 0.0 до 1.0,
  "sentiment": "positive" | "negative" | "neutral",
  "summary": "краткое резюме обращения на русском, 1-2 предложения",
  "extracted_data": {
    "train_number": число или null,
    "car_number": число или null,
    "seat_number": число или null,
    "station_name": "строка или null",
    "person_name": "строка или null"
  }
}"""


class AppealClassifier:
    def __init__(self):
        settings = get_settings()
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_model

    async def classify(self, text: str, language: str = "ru") -> dict:
        """Classify an appeal text and extract structured data."""
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": CLASSIFICATION_SYSTEM_PROMPT},
                    {"role": "user", "content": f"Язык обращения: {language}\n\nТекст обращения:\n{text}"},
                ],
                temperature=0.1,
                max_tokens=500,
                response_format={"type": "json_object"},
            )

            raw = response.choices[0].message.content
            result = json.loads(raw)

            # Validate required fields
            valid_categories = {"gratitude", "lost_items", "ticket_return", "complaint", "suggestion"}
            if result.get("category") not in valid_categories:
                logger.warning("LLM returned invalid category: %s, falling back", result.get("category"))
                return self._fallback(text)
            confidence = result.get("confidence")
            if not isinstance(confidence, (int, float)) or not (0.0 <= confidence <= 1.0):
                result["confidence"] = 0.5

            logger.info("Classification result: %s", result)
            return result

        except json.JSONDecodeError:
            logger.error("Failed to parse LLM response as JSON: %s", raw)
            return self._fallback(text)
        except Exception:
            logger.exception("LLM classification failed")
            return self._fallback(text)

    def _fallback(self, text: str) -> dict:
        """Simple keyword-based fallback when LLM is unavailable."""
        text_lower = text.lower()

        if any(w in text_lower for w in ("спасибо", "благодар", "рахмет", "алғыс")):
            category = "gratitude"
        elif any(w in text_lower for w in ("забыл", "оставил", "потерял", "ұмыт")):
            category = "lost_items"
        elif any(w in text_lower for w in ("возврат", "вернуть", "билет", "қайтару")):
            category = "ticket_return"
        elif any(w in text_lower for w in ("жалоб", "претенз", "плохо", "ужас", "шағым")):
            category = "complaint"
        elif any(w in text_lower for w in ("предлаг", "предложен", "улучш", "ұсыныс")):
            category = "suggestion"
        else:
            category = "complaint"

        return {
            "category": category,
            "subcategory": None,
            "confidence": 0.5,
            "sentiment": "neutral",
            "summary": text[:200],
            "extracted_data": {},
        }
