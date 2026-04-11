"""
LLM-based response generator.
Generates contextual auto-responses for different appeal categories.
"""
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
            lang_name = "казахском" if language == "kz" else "русском"
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
        }
        lang_fb = fallbacks.get(language, fallbacks["ru"])
        return lang_fb.get(category, lang_fb.get("complaint", "Ваше обращение принято."))
