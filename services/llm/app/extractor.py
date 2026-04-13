"""
LLM-based data extractor for the smart bot engine.

Extracts structured data (language, category, subcategory, attributes)
from free-text user messages using GPT-4o with JSON response mode.
Falls back to keyword-based classification when the LLM is unavailable.
"""
import json
import logging
import re
from datetime import datetime, timezone, timedelta

from openai import AsyncOpenAI
from shared.config import get_settings

logger = logging.getLogger(__name__)

KZ_TZ = timezone(timedelta(hours=6))

EXTRACTION_SYSTEM_PROMPT = """Ты — система извлечения данных для службы поддержки КТЖ (Казахстан Темір Жолы).

Ты получаешь:
1. Историю диалога (если есть)
2. Последнее сообщение пользователя
3. Ранее извлечённые данные (из предыдущих ходов)

Твои задачи:
1. ОПРЕДЕЛИ язык сообщения: "ru" (русский), "kz" (казахский), "en" (английский)
2. КЛАССИФИЦИРУЙ обращение по категории и подкатегории
3. ИЗВЛЕКИ все структурированные данные из текста

Категории:
- gratitude — благодарность (положительный отзыв о сотруднике или сервисе)
  Подкатегории: train_crew (проводник/работник поезда), ticket_cashier (билетный кассир), other_gratitude (другое)
- lost_items — забытые вещи (клиент забыл что-то в поезде)
- ticket_return — возврат билета
- complaint — жалоба
  Подкатегории: train_delay (опоздание поезда), conductor_complaint (жалоба на проводника), service_complaint (жалоба на сервис), other (другое)
- suggestion — предложение по улучшению

Извлекаемые поля:
- train_number: целое число — номер поезда (напр. "поезд 42" → 42)
- car_number: целое число — номер вагона
- seat_number: целое число — номер места
- event_date: дата в формате ISO (YYYY-MM-DD). Парси из "вчера", "15 марта", "15.03.2026" и т.д. Сегодня: {today}
- station_name: название станции
- cashier_name: ФИО кассира
- person_name: ФИО любого упомянутого сотрудника КТЖ
- full_name: ФИО самого клиента (обращающегося), если он назвал своё имя
- item_description: описание забытой вещи
- ticket_number: номер билета
- reason: суть обращения (за что благодарность, причина жалобы, описание проблемы)
- delay_details: детали опоздания поезда

ПРАВИЛА:
- Извлекай ТОЛЬКО те данные, которые БУКВАЛЬНО присутствуют в тексте сообщения
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО придумывать, угадывать, додумывать или подставлять данные которых нет в тексте
- Если клиент НЕ назвал станцию — station_name: null. Если НЕ назвал имя — person_name: null. И так для КАЖДОГО поля
- Если поле уже было извлечено ранее, сохрани его (если пользователь не исправил)
- Объедини новые данные с ранее извлечёнными
- Для всех неизвестных полей ставь null — лучше null чем выдумка
- Поле reason — КОНКРЕТНОЕ описание того, что произошло. Пример: "поезд опоздал на час" → reason: "Поезд опоздал на час". "проводник нагрубил" → reason: "Проводник нагрубил".
- НО общие фразы БЕЗ деталей — это НЕ reason. Пример: "жалоба по поезду", "есть жалоба", "хочу пожаловаться" → reason: null (клиент ещё не рассказал что именно случилось).
- ВСЕГДА заполняй summary — краткое резюме обращения на русском. Не оставляй null.

Верни ТОЛЬКО валидный JSON:
{{
  "detected_language": "ru" | "kz" | "en",
  "category": "категория или null если неясно",
  "subcategory": "подкатегория или null",
  "confidence": 0.0-1.0,
  "sentiment": "positive" | "negative" | "neutral",
  "summary": "краткое резюме на русском, 1-2 предложения",
  "extracted_fields": {{
    "train_number": int или null,
    "car_number": int или null,
    "seat_number": int или null,
    "event_date": "YYYY-MM-DD" или null,
    "station_name": "строка" или null,
    "cashier_name": "строка" или null,
    "person_name": "строка" или null,
    "full_name": "строка" или null,
    "item_description": "строка" или null,
    "ticket_number": "строка" или null,
    "reason": "строка" или null,
    "delay_details": "строка" или null
  }}
}}"""


class AppealExtractor:
    def __init__(self):
        settings = get_settings()
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_model

    async def extract(
        self,
        conversation_history: list[dict],
        latest_message: str,
        previously_extracted: dict | None = None,
        language: str | None = None,
    ) -> dict:
        """
        Extract structured data from the latest user message,
        taking into account conversation history and previously extracted fields.
        """
        try:
            system_prompt = EXTRACTION_SYSTEM_PROMPT.format(
                today=datetime.now(KZ_TZ).date().isoformat()
            )

            # Build messages for the LLM
            messages = [{"role": "system", "content": system_prompt}]

            # Add context about previously extracted data
            context_parts = []
            if previously_extracted:
                non_null = {k: v for k, v in previously_extracted.items() if v is not None}
                if non_null:
                    context_parts.append(
                        f"Ранее извлечённые данные: {json.dumps(non_null, ensure_ascii=False)}"
                    )
            if language:
                context_parts.append(f"Язык предыдущих сообщений: {language}")

            # Add conversation history (last 8 turns max to stay within token limits)
            history_messages = conversation_history[-8:]
            if history_messages:
                history_text = "\n".join(
                    f"{'Клиент' if m['role'] == 'user' else 'Бот'}: {m['text']}"
                    for m in history_messages[:-1]  # exclude latest, it's sent separately
                )
                if history_text:
                    context_parts.append(f"История диалога:\n{history_text}")

            user_content = ""
            if context_parts:
                user_content = "\n\n".join(context_parts) + "\n\n"
            user_content += f"Последнее сообщение клиента:\n{latest_message}"

            messages.append({"role": "user", "content": user_content})

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.1,
                max_tokens=800,
                response_format={"type": "json_object"},
            )

            raw = response.choices[0].message.content
            result = json.loads(raw)

            # Validate category
            valid_categories = {
                "gratitude", "lost_items", "ticket_return",
                "complaint", "suggestion",
            }
            if result.get("category") and result["category"] not in valid_categories:
                logger.warning("LLM returned invalid category: %s", result["category"])
                result["category"] = None

            # Ensure confidence is valid
            confidence = result.get("confidence")
            if not isinstance(confidence, (int, float)) or not (0.0 <= confidence <= 1.0):
                result["confidence"] = 0.5

            # Ensure extracted_fields exists
            if "extracted_fields" not in result:
                result["extracted_fields"] = {}

            logger.info(
                "Extraction result: category=%s, subcategory=%s, confidence=%.2f",
                result.get("category"),
                result.get("subcategory"),
                result.get("confidence", 0),
            )
            return result

        except json.JSONDecodeError:
            logger.error("Failed to parse LLM extraction response as JSON")
            return self._fallback(latest_message, language)
        except Exception:
            logger.exception("LLM extraction failed")
            return self._fallback(latest_message, language)

    def _fallback(self, text: str, language: str | None = None) -> dict:
        """Keyword-based fallback when the LLM is unavailable."""
        text_lower = text.lower()

        # Detect language from keywords
        detected_language = language or "ru"
        if any(w in text_lower for w in ("thank", "forgot", "lost", "refund", "complaint")):
            detected_language = "en"
        elif any(w in text_lower for w in ("рахмет", "алғыс", "ұмыт", "қайтару", "шағым")):
            detected_language = "kz"

        # Classify by keywords
        if any(w in text_lower for w in (
            "спасибо", "благодар", "рахмет", "алғыс", "thank", "grateful",
        )):
            category = "gratitude"
        elif any(w in text_lower for w in (
            "забыл", "оставил", "потерял", "ұмыт", "forgot", "lost", "left",
        )):
            category = "lost_items"
        elif any(w in text_lower for w in (
            "возврат", "вернуть", "билет", "қайтару", "refund", "return", "ticket",
        )):
            category = "ticket_return"
        elif any(w in text_lower for w in (
            "жалоб", "претенз", "плохо", "ужас", "шағым", "complaint", "terrible",
        )):
            category = "complaint"
        elif any(w in text_lower for w in (
            "предлаг", "предложен", "улучш", "ұсыныс", "suggest", "improve",
        )):
            category = "suggestion"
        else:
            category = None

        extracted_fields: dict = {"reason": text[:500]}

        train_match = re.search(
            r"(?:поезд[аеу]?\s*[№#]?\s*|train\s*#?\s*|пойыз\s*[№#]?\s*)(\d+)",
            text_lower,
        )
        if train_match:
            extracted_fields["train_number"] = int(train_match.group(1))

        car_match = re.search(
            r"(?:вагон[аеу]?\s*[№#]?\s*|car\s*#?\s*)(\d+)", text_lower
        )
        if car_match:
            extracted_fields["car_number"] = int(car_match.group(1))

        seat_match = re.search(
            r"(?:мест[аое]?\s*[№#]?\s*|seat\s*#?\s*)(\d+)", text_lower
        )
        if seat_match:
            extracted_fields["seat_number"] = int(seat_match.group(1))

        return {
            "detected_language": detected_language,
            "category": category,
            "subcategory": None,
            "confidence": 0.3,
            "sentiment": "neutral",
            "summary": text[:200],
            "extracted_fields": extracted_fields,
        }
