"""
LLM-based response generator.
Generates contextual auto-responses and follow-up questions
for different appeal categories.
"""
import json
import logging

from openai import AsyncOpenAI
from shared.config import get_settings

logger = logging.getLogger(__name__)

RESPONSE_SYSTEM_PROMPT = """Ты — вежливый и профессиональный оператор службы поддержки КТЖ (Казахстан Темір Жолы).

Твоя задача — сгенерировать короткий, вежливый ответ клиенту на его обращение.
Ответ должен быть на том же языке, на котором написано обращение.

Правила:
- Подтверди получение обращения
- Будь кратким (2-4 предложения)
- Если это благодарность — поблагодари клиента за обратную связь
- Если это жалоба — вырази сочувствие и заверь что обращение будет рассмотрено
- Если это возврат билета — укажи что специалист свяжется для уточнения деталей
- Если это забытые вещи — укажи что информация передана в соответствующую службу
- Если это предложение — поблагодари за идею
- Не обещай конкретных сроков
- Не используй эмодзи"""

FOLLOWUP_SYSTEM_PROMPT = """Ты — оператор чата поддержки КТЖ (Казахстан Темір Жолы). Веди диалог естественно, как живой человек в мессенджере.

ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА:
1. Если клиент сообщил новые данные — КРАТКО подтверди их (например: «Хорошо, поезд 301.» или «Принял, станция Алматы 2.»)
2. НИКОГДА не повторяй фразы, которые ты уже использовал в предыдущих сообщениях. Посмотри на свои прошлые ответы и напиши ИНАЧЕ.
3. Спрашивай ТОЛЬКО то, чего не хватает — не переспрашивай то, что уже известно.
4. Пиши коротко: 1-2 предложения, как в чате, не как в официальном письме.
5. Варьируй начало сообщений — не начинай каждый раз одинаково.
6. Если клиент написал что-то не по теме (не связанное с поездами, железной дорогой, КТЖ), мягко напомни что ты помощник КТЖ и верни к обращению.
7. Пиши на указанном языке.
8. Не используй эмодзи.

ПЛОХО: «Понимаю вашу проблему. Уточните, пожалуйста, номер поезда и подробности.»
ПЛОХО (повтор): «Понимаю вашу проблему. Уточните, пожалуйста, подробности.»
ХОРОШО: «Записал, поезд 301. Подскажите, когда это было?»
ХОРОШО: «Хорошо. А можете описать подробнее, что именно произошло?»
ХОРОШО (off-topic): «Я могу помочь только с вопросами по железной дороге. Давайте вернёмся — подскажите номер поезда?»"""

LANG_NAMES = {"ru": "русском", "kz": "казахском", "en": "английском"}


class ResponseGenerator:
    def __init__(self):
        settings = get_settings()
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_model

    async def generate(
        self, text: str, category: str, language: str = "ru"
    ) -> str:
        """Generate an auto-response for a client appeal."""
        try:
            lang_name = LANG_NAMES.get(language, "русском")
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": RESPONSE_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": (
                            f"Категория обращения: {category}\n"
                            f"Язык ответа: на {lang_name}\n\n"
                            f"Текст обращения клиента:\n{text}"
                        ),
                    },
                ],
                temperature=0.7,
                max_tokens=300,
            )

            reply = response.choices[0].message.content.strip()
            logger.info("Generated response for category=%s: %s", category, reply[:100])
            return reply

        except Exception:
            logger.exception("LLM response generation failed, using fallback")
            return self._fallback(category, language)

    async def generate_followup(
        self,
        category: str | None,
        subcategory: str | None,
        missing_fields: dict[str, str],
        language: str,
        conversation_history: list[dict] | None = None,
        collected_fields: dict | None = None,
    ) -> str:
        """
        Generate a natural follow-up question asking for missing fields.
        missing_fields: {field_name: human_readable_description}
        collected_fields: {field_name: value} — already collected data
        """
        try:
            lang_name = LANG_NAMES.get(language, "русском")

            missing_list = "\n".join(
                f"- {desc}" for desc in missing_fields.values()
            )

            # Build instruction with context about collected and missing data
            instruction = f"[Язык ответа: {lang_name}]\n"
            instruction += f"[Категория: {category or 'не определена'}]\n"
            if subcategory:
                instruction += f"[Подкатегория: {subcategory}]\n"

            if collected_fields:
                collected_list = "\n".join(
                    f"- {k}: {v}" for k, v in collected_fields.items()
                    if v is not None
                )
                if collected_list:
                    instruction += f"\n[Уже собранные данные:\n{collected_list}]\n"

            instruction += f"\n[Нужно ещё узнать:\n{missing_list}]\n"
            instruction += "\nНапиши следующее сообщение клиенту."

            # Build messages: system + conversation history as chat + instruction
            messages: list[dict] = [
                {"role": "system", "content": FOLLOWUP_SYSTEM_PROMPT},
            ]
            if conversation_history:
                for msg in conversation_history[-8:]:
                    role = "user" if msg["role"] == "user" else "assistant"
                    messages.append({"role": role, "content": msg["text"]})

            messages.append({"role": "user", "content": instruction})

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.8,
                max_tokens=200,
            )

            reply = response.choices[0].message.content.strip()
            logger.info("Generated followup for category=%s: %s", category, reply[:100])
            return reply

        except Exception:
            logger.exception("LLM followup generation failed, using fallback")
            return self._followup_fallback(missing_fields, language)

    def _fallback(self, category: str, language: str) -> str:
        """Fallback responses when LLM is unavailable."""
        fallbacks = {
            "ru": {
                "gratitude": "Ваша благодарность принята. Спасибо за обратную связь! Мы передадим её сотруднику.",
                "lost_items": "Ваше обращение о забытой вещи принято. Информация передана в соответствующую службу. Мы свяжемся с вами.",
                "ticket_return": "Ваше обращение по возврату билета принято. Специалист свяжется с вами для уточнения деталей.",
                "complaint": "Ваша жалоба принята и будет рассмотрена. Приносим извинения за доставленные неудобства.",
                "suggestion": "Спасибо за ваше предложение! Оно будет рассмотрено соответствующим подразделением.",
            },
            "kz": {
                "gratitude": "Алғысыңыз қабылданды. Кері байланыс үшін рахмет! Біз оны қызметкерге жеткіземіз.",
                "lost_items": "Ұмытылған зат туралы өтінішіңіз қабылданды. Ақпарат тиісті қызметке жіберілді.",
                "ticket_return": "Билетті қайтару бойынша өтінішіңіз қабылданды. Маман сізбен хабарласады.",
                "complaint": "Шағымыңыз қабылданды және қаралады. Қолайсыздық үшін кешірім сұраймыз.",
                "suggestion": "Ұсынысыңыз үшін рахмет! Ол тиісті бөлімде қаралады.",
            },
            "en": {
                "gratitude": "Your gratitude has been received. Thank you for your feedback! We will pass it on to the employee.",
                "lost_items": "Your report about a lost item has been received. The information has been forwarded to the relevant department. We will contact you.",
                "ticket_return": "Your ticket refund request has been received. A specialist will contact you to clarify the details.",
                "complaint": "Your complaint has been received and will be reviewed. We apologize for the inconvenience.",
                "suggestion": "Thank you for your suggestion! It will be reviewed by the relevant department.",
            },
        }
        lang_fb = fallbacks.get(language, fallbacks["ru"])
        return lang_fb.get(category, lang_fb.get("complaint", "Ваше обращение принято."))

    def _followup_fallback(self, missing_fields: dict[str, str], language: str) -> str:
        """Fallback follow-up when LLM is unavailable."""
        if language == "kz":
            prefix = "Өтінішіңізді өңдеу үшін мына ақпарат қажет:"
        elif language == "en":
            prefix = "To process your request, we need the following information:"
        else:
            prefix = "Для обработки вашего обращения нам нужна следующая информация:"

        items = "\n".join(f"- {desc}" for desc in missing_fields.values())
        return f"{prefix}\n{items}"
