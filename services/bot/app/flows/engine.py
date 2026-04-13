"""
Smart bot conversation engine — hybrid LLM + rule-based approach.

Replaces the old state machine with an extract-validate-ask loop:
1. LLM extracts structured data from user's free text
2. Code validates required attributes per category schema
3. If missing fields remain, LLM generates a natural follow-up question
4. When all fields are collected, the appeal is marked as completed
"""
import logging

import httpx

from app.flows.schemas import get_missing_fields
from app.flows.session import SessionManager

logger = logging.getLogger(__name__)

MAX_TURNS = 10
MAX_HISTORY = 20
MAX_CATEGORY_ATTEMPTS = 3
LLM_SERVICE_URL = "http://llm:8003"

TIMEOUT_MESSAGES = {
    "ru": "Извините, мы не смогли собрать всю необходимую информацию. Ваше обращение будет передано оператору для дальнейшей обработки.",
    "kz": "Кешіріңіз, барлық қажетті ақпаратты жинай алмадық. Сіздің өтінішіңіз одан әрі өңдеу үшін операторға жіберіледі.",
    "en": "Sorry, we were unable to collect all the required information. Your request will be forwarded to an operator for further processing.",
}

COMPLETION_MESSAGES = {
    "ru": "Спасибо! Ваше обращение принято и передано ответственным специалистам. Мы свяжемся с вами в ближайшее время.",
    "kz": "Рахмет! Сіздің өтінішіңіз қабылданды және жауапты мамандарға жіберілді. Жақын арада сізбен хабарласамыз.",
    "en": "Thank you! Your request has been received and forwarded to the responsible specialists. We will contact you shortly.",
}

GREETING_MESSAGES = {
    "ru": "Здравствуйте! Я — виртуальный помощник КТЖ. Чем могу помочь? Вы можете написать о благодарности, забытых вещах, возврате билета, жалобе или предложении.",
    "kz": "Сәлеметсіз бе! Мен КТЖ виртуалды көмекшісімін. Сізге қалай көмектесе аламын? Алғыс, ұмытылған заттар, билетті қайтару, шағым немесе ұсыныс туралы жаза аласыз.",
    "en": "Hello! I am the KTZh virtual assistant. How can I help you? You can write about gratitude, lost items, ticket refund, complaints, or suggestions.",
}

OFF_TOPIC_MESSAGES = {
    "ru": "Я могу помочь вам с:\n- Жалобой на поезд или сервис\n- Благодарностью сотрудникам\n- Забытыми вещами\n- Возвратом билета\n- Предложением по улучшению\n\nПожалуйста, опишите вашу ситуацию.",
    "kz": "Мен сізге көмектесе аламын:\n- Пойызға немесе сервиске шағым\n- Қызметкерлерге алғыс\n- Ұмытылған заттар\n- Билетті қайтару\n- Жақсарту ұсынысы\n\nЖағдайыңызды сипаттаңыз.",
    "en": "I can help you with:\n- Complaints about trains or service\n- Gratitude to staff\n- Lost items\n- Ticket refund\n- Suggestions for improvement\n\nPlease describe your situation.",
}

MAX_LLM_FAILURES = 2
MAX_CONFIRM_ATTEMPTS = 3
_INT_FIELDS = {"train_number", "car_number", "seat_number"}

_CONFIRM_WORDS = {
    "да", "верно", "правильно", "все верно", "всё верно", "ок", "ok", "yes",
    "correct", "right", "иә", "дұрыс", "confirm", "подтверждаю",
}

_PLEASANTRY_WORDS = {
    # Russian (20)
    "спасибо", "спасибо большое", "большое спасибо", "благодарю", "благодарю вас",
    "спс", "пасиба", "пасибо", "спасибки", "благодарствую",
    "до свидания", "пока", "всего доброго", "хорошего дня", "удачи",
    "всего хорошего", "до встречи", "ладно спасибо", "ок спасибо", "понял спасибо",
    # Kazakh (20)
    "рахмет", "рахмет сізге", "үлкен рахмет", "көп рахмет", "алғысымды білдіремін",
    "сау болыңыз", "сау бол", "қош болыңыз", "қош бол", "жақсы күн",
    "рақмет", "рахметсіз", "баршаңызға рахмет", "айналайын рахмет", "тағы рахмет",
    "жарайды рахмет", "ок рахмет", "түсіндім рахмет", "жақсы рахмет", "мәселе жоқ рахмет",
    # English (20)
    "thanks", "thank you", "thank you very much", "thanks a lot", "thx",
    "ty", "thanx", "many thanks", "much appreciated", "appreciated",
    "goodbye", "bye", "bye bye", "good bye", "see you",
    "cheers", "take care", "have a good day", "ok thanks", "got it thanks",
    # Emoji
    "👍", "🙏", "👌", "❤️", "🤝",
}

PLEASANTRY_RESPONSES = {
    "ru": "Спасибо за обращение! Если у вас появятся другие вопросы — пишите, мы всегда на связи.",
    "kz": "Өтінішіңізге рахмет! Басқа сұрақтарыңыз болса — жазыңыз, біз әрқашан байланыстамыз.",
    "en": "Thank you for reaching out! If you have any more questions, feel free to write — we're always here.",
}

_FIELD_LABELS = {
    "ru": {
        "category": "Тема", "train_number": "Поезд", "car_number": "Вагон",
        "seat_number": "Место", "event_date": "Дата", "station_name": "Станция",
        "reason": "Описание", "item_description": "Забытая вещь",
        "ticket_number": "Номер билета", "person_name": "Сотрудник",
        "cashier_name": "Кассир", "full_name": "ФИО клиента",
    },
    "kz": {
        "category": "Тақырып", "train_number": "Пойыз", "car_number": "Вагон",
        "seat_number": "Орын", "event_date": "Күні", "station_name": "Стансы",
        "reason": "Сипаттама", "item_description": "Ұмытылған зат",
        "ticket_number": "Билет нөмірі", "person_name": "Қызметкер",
        "cashier_name": "Кассир", "full_name": "Клиенттің аты-жөні",
    },
    "en": {
        "category": "Topic", "train_number": "Train", "car_number": "Car",
        "seat_number": "Seat", "event_date": "Date", "station_name": "Station",
        "reason": "Description", "item_description": "Lost item",
        "ticket_number": "Ticket number", "person_name": "Employee",
        "cashier_name": "Cashier", "full_name": "Client name",
    },
}

_CATEGORY_LABELS = {
    "ru": {
        "complaint": "Жалоба", "gratitude": "Благодарность",
        "lost_items": "Забытые вещи", "ticket_return": "Возврат билета",
        "suggestion": "Предложение",
    },
    "kz": {
        "complaint": "Шағым", "gratitude": "Алғыс",
        "lost_items": "Ұмытылған заттар", "ticket_return": "Билетті қайтару",
        "suggestion": "Ұсыныс",
    },
    "en": {
        "complaint": "Complaint", "gratitude": "Gratitude",
        "lost_items": "Lost items", "ticket_return": "Ticket refund",
        "suggestion": "Suggestion",
    },
}

_CONFIRM_SUFFIX = {
    "ru": "\nВсё верно? Ответьте «Да» или укажите, что нужно исправить.",
    "kz": "\nБарлығы дұрыс па? «Иә» деп жауап беріңіз немесе нені түзету керектігін көрсетіңіз.",
    "en": "\nIs everything correct? Reply 'Yes' or tell me what to fix.",
}


class SmartBotEngine:
    """
    Hybrid LLM-powered bot engine.

    Uses LLM for data extraction and natural response generation,
    and code-based rules for attribute validation and flow control.
    """

    def __init__(self, session_manager: SessionManager):
        self.sessions = session_manager
        self.http = httpx.AsyncClient(base_url=LLM_SERVICE_URL, timeout=15.0)

    async def close(self) -> None:
        await self.http.aclose()

    async def process_message(self, phone: str, text: str) -> list[str]:
        """
        Process an incoming message from a user.
        Returns a list of response messages to send back.

        Same interface as the old BotEngine for backward compatibility.
        """
        session = await self.sessions.get(phone)

        # Detect post-completion pleasantries (e.g. "спасибо" after appeal was submitted)
        is_new_session = session is None or session.get("state") == "completed"
        if is_new_session and self._is_pleasantry(text):
            lang = (session.get("language") if session else None) or "ru"
            if session:
                await self.sessions.delete(phone)
            return [PLEASANTRY_RESPONSES.get(lang, PLEASANTRY_RESPONSES["ru"])]

        if session is None:
            session = await self.sessions.create(phone)

        # If previous session completed, start fresh
        if session.get("state") == "completed":
            session = await self.sessions.create(phone)

        # Handle confirmation phase
        if session.get("state") == "confirming":
            return await self._handle_confirmation(phone, text, session)

        # Safety: max turns limit
        if session.get("turn_count", 0) >= MAX_TURNS:
            extracted = session.get("extracted", {})
            if not extracted.get("category"):
                extracted["category"] = "complaint"
            if not extracted.get("reason") and not extracted.get("summary"):
                user_msgs = [
                    m["text"] for m in session.get("conversation_history", [])
                    if m["role"] == "user"
                ]
                extracted["reason"] = " | ".join(user_msgs) if user_msgs else "Таймаут диалога"
            session["extracted"] = extracted
            session["state"] = "completed"
            await self.sessions.save(phone, session)
            lang = session.get("language") or "ru"
            return [TIMEOUT_MESSAGES.get(lang, TIMEOUT_MESSAGES["ru"])]

        # Add user message to conversation history
        session.setdefault("conversation_history", []).append(
            {"role": "user", "text": text}
        )
        session["turn_count"] = session.get("turn_count", 0) + 1

        # --- Phase A: LLM Extraction ---
        extracted = session.get("extracted", {})
        extract_result = await self._call_extract(
            conversation_history=session["conversation_history"],
            latest_message=text,
            previously_extracted=extracted,
            language=session.get("language"),
        )

        if extract_result is None:
            session["llm_failures"] = session.get("llm_failures", 0) + 1
            lang = session.get("language") or "ru"

            if session["llm_failures"] >= MAX_LLM_FAILURES:
                session["state"] = "completed"
                response = TIMEOUT_MESSAGES.get(lang, TIMEOUT_MESSAGES["ru"])
                session["conversation_history"].append({"role": "assistant", "text": response})
                self._trim_history(session)
                await self.sessions.save(phone, session)
                return [response]

            response = GREETING_MESSAGES.get(lang, GREETING_MESSAGES["ru"])
            session["conversation_history"].append({"role": "assistant", "text": response})
            self._trim_history(session)
            await self.sessions.save(phone, session)
            return [response]

        session["llm_failures"] = 0

        # Merge extracted fields (never overwrite with None)
        new_fields = extract_result.get("extracted_fields", {})
        for key, value in new_fields.items():
            if value is not None:
                extracted[key] = value

        # Update top-level classification fields (category is locked once set)
        for field in ("category", "subcategory", "summary", "confidence", "sentiment"):
            new_val = extract_result.get(field)
            if new_val is not None:
                if field == "category" and extracted.get("category"):
                    continue
                if field == "subcategory" and extracted.get("category"):
                    if extract_result.get("category") != extracted.get("category"):
                        continue
                extracted[field] = new_val

        self._sanitize_extracted(extracted)
        session["extracted"] = extracted

        # Update language (auto-detect)
        detected_lang = extract_result.get("detected_language")
        if detected_lang and detected_lang in ("ru", "kz", "en"):
            session["language"] = detected_lang
        lang = session.get("language") or "ru"

        # --- Phase B: Validate required fields ---
        category = extracted.get("category")
        subcategory = extracted.get("subcategory")

        if not category:
            session["category_attempts"] = session.get("category_attempts", 0) + 1

            if session["category_attempts"] >= MAX_CATEGORY_ATTEMPTS:
                extracted["category"] = "complaint"
                session["extracted"] = extracted
                category = "complaint"
                logger.info("Forced category=complaint for %s after %d attempts", phone, session["category_attempts"])
            else:
                if session["category_attempts"] >= 2:
                    followup = OFF_TOPIC_MESSAGES.get(lang, OFF_TOPIC_MESSAGES["ru"])
                else:
                    followup = await self._call_followup(
                        category=None,
                        subcategory=None,
                        missing_fields={"category": "тема обращения / topic of your request / өтініш тақырыбы"},
                        language=lang,
                        conversation_history=session["conversation_history"],
                        collected_fields={k: v for k, v in extracted.items() if v is not None},
                    )
                session["conversation_history"].append({"role": "assistant", "text": followup})
                self._trim_history(session)
                await self.sessions.save(phone, session)
                return [followup]

        # Fallback: use summary as reason if LLM filled summary but not reason
        if not extracted.get("reason") and extracted.get("summary"):
            extracted["reason"] = extracted["summary"]
            session["extracted"] = extracted

        missing = get_missing_fields(category, subcategory, extracted)

        # --- Phase C: Ask or Complete ---
        if missing:
            followup = await self._call_followup(
                category=category,
                subcategory=subcategory,
                missing_fields=missing,
                language=lang,
                conversation_history=session["conversation_history"],
                collected_fields={k: v for k, v in extracted.items() if v is not None},
            )
            session["conversation_history"].append({"role": "assistant", "text": followup})
            self._trim_history(session)
            await self.sessions.save(phone, session)
            return [followup]

        # All required fields collected — ask for confirmation
        session["state"] = "confirming"
        confirmation_msg = self._build_confirmation_message(extracted, category, lang)
        session["conversation_history"].append({"role": "assistant", "text": confirmation_msg})
        self._trim_history(session)
        await self.sessions.save(phone, session)
        return [confirmation_msg]

    async def get_completed_data(self, phone: str) -> dict | None:
        """
        If session is completed, return collected data and delete session.

        Same interface as the old BotEngine for backward compatibility.
        """
        session = await self.sessions.get(phone)
        if session is None:
            return None
        if session.get("state") != "completed":
            return None

        extracted = session.get("extracted", {})
        result = {
            "phone": session["phone"],
            "language": session.get("language") or "ru",
            "category": extracted.get("category", "complaint"),
            "subcategory": extracted.get("subcategory"),
            "train_number": extracted.get("train_number"),
            "event_date": extracted.get("event_date"),
            "car_number": extracted.get("car_number"),
            "seat_number": extracted.get("seat_number"),
            "station_name": extracted.get("station_name"),
            "cashier_name": extracted.get("cashier_name"),
            "person_name": extracted.get("person_name"),
            "full_name": extracted.get("full_name"),
            "item_description": extracted.get("item_description"),
            "ticket_number": extracted.get("ticket_number"),
            "client_message": self._build_client_message(extracted, session),
            "bot_classified": extracted.get("confidence", 0) >= 0.5,
            # Extra fields for metadata
            "confidence": extracted.get("confidence"),
            "sentiment": extracted.get("sentiment"),
            "summary": extracted.get("summary"),
            "conversation_history": session.get("conversation_history", []),
        }

        await self.sessions.delete(phone)
        return result

    async def _handle_confirmation(
        self, phone: str, text: str, session: dict
    ) -> list[str]:
        """Handle user response to a data confirmation prompt."""
        lang = session.get("language") or "ru"
        session.setdefault("conversation_history", []).append(
            {"role": "user", "text": text}
        )
        session["turn_count"] = session.get("turn_count", 0) + 1

        session["confirm_attempts"] = session.get("confirm_attempts", 0) + 1

        if self._check_confirmation(text):
            session["state"] = "completed"
            response = COMPLETION_MESSAGES.get(lang, COMPLETION_MESSAGES["ru"])
            session["conversation_history"].append({"role": "assistant", "text": response})
            self._trim_history(session)
            await self.sessions.save(phone, session)
            return [response]

        if session["confirm_attempts"] >= MAX_CONFIRM_ATTEMPTS:
            session["state"] = "completed"
            response = COMPLETION_MESSAGES.get(lang, COMPLETION_MESSAGES["ru"])
            session["conversation_history"].append({"role": "assistant", "text": response})
            self._trim_history(session)
            await self.sessions.save(phone, session)
            return [response]

        extracted = session.get("extracted", {})
        extract_result = await self._call_extract(
            conversation_history=session["conversation_history"],
            latest_message=text,
            previously_extracted=extracted,
            language=lang,
        )

        if extract_result:
            new_fields = extract_result.get("extracted_fields", {})
            for key, value in new_fields.items():
                if value is not None:
                    extracted[key] = value
            self._sanitize_extracted(extracted)
            session["extracted"] = extracted

        category = extracted.get("category", "complaint")
        confirmation_msg = self._build_confirmation_message(extracted, category, lang)
        session["conversation_history"].append({"role": "assistant", "text": confirmation_msg})
        self._trim_history(session)
        await self.sessions.save(phone, session)
        return [confirmation_msg]

    @staticmethod
    def _check_confirmation(text: str) -> bool:
        """Check if the user's message is a confirmation."""
        normalized = text.strip().lower().rstrip(".!,")
        return normalized in _CONFIRM_WORDS

    @staticmethod
    def _is_pleasantry(text: str) -> bool:
        """Check if the message is a simple pleasantry (thank you, goodbye, etc.)."""
        normalized = text.strip().lower().rstrip(".!,")
        return normalized in _PLEASANTRY_WORDS

    def _build_confirmation_message(
        self, extracted: dict, category: str, lang: str
    ) -> str:
        """Build a human-readable summary of collected data for confirmation."""
        labels = _FIELD_LABELS.get(lang, _FIELD_LABELS["ru"])
        cat_labels = _CATEGORY_LABELS.get(lang, _CATEGORY_LABELS["ru"])

        lines = []
        cat_display = cat_labels.get(category, category)
        lines.append(f"- {labels.get('category', 'Тема')}: {cat_display}")

        display_fields = [
            "full_name", "train_number", "car_number", "seat_number", "event_date",
            "station_name", "person_name", "cashier_name",
            "item_description", "ticket_number", "reason",
        ]
        for field in display_fields:
            val = extracted.get(field)
            if val is not None:
                label = labels.get(field, field)
                display_val = str(val)[:100]
                lines.append(f"- {label}: {display_val}")

        summary = "\n".join(lines)
        suffix = _CONFIRM_SUFFIX.get(lang, _CONFIRM_SUFFIX["ru"])
        return summary + suffix

    @staticmethod
    def _sanitize_extracted(extracted: dict) -> dict:
        """Coerce numeric fields to int, set to None on failure."""
        for field in _INT_FIELDS:
            val = extracted.get(field)
            if val is not None and not isinstance(val, int):
                try:
                    extracted[field] = int(val)
                except (ValueError, TypeError):
                    extracted[field] = None
        return extracted

    @staticmethod
    def _build_client_message(extracted: dict, session: dict) -> str:
        """Build client_message with fallback to conversation history."""
        msg = extracted.get("reason") or extracted.get("summary", "")
        if msg:
            return msg
        user_messages = [
            m["text"] for m in session.get("conversation_history", [])
            if m["role"] == "user"
        ]
        return " | ".join(user_messages) if user_messages else "Обращение без текста"

    @staticmethod
    def _trim_history(session: dict) -> None:
        """Keep conversation_history within MAX_HISTORY entries."""
        history = session.get("conversation_history", [])
        if len(history) > MAX_HISTORY:
            session["conversation_history"] = history[-MAX_HISTORY:]

    # --- LLM service calls ---

    async def _call_extract(
        self,
        conversation_history: list[dict],
        latest_message: str,
        previously_extracted: dict,
        language: str | None,
    ) -> dict | None:
        """Call LLM /extract endpoint."""
        try:
            resp = await self.http.post(
                "/llm/extract",
                json={
                    "conversation_history": conversation_history,
                    "latest_message": latest_message,
                    "previously_extracted": previously_extracted,
                    "language": language,
                },
            )
            resp.raise_for_status()
            return resp.json()
        except Exception:
            logger.exception("LLM extract call failed")
            return None

    async def _call_followup(
        self,
        category: str | None,
        subcategory: str | None,
        missing_fields: dict[str, str],
        language: str,
        conversation_history: list[dict],
        collected_fields: dict | None = None,
    ) -> str:
        """Call LLM /generate-followup endpoint."""
        try:
            resp = await self.http.post(
                "/llm/generate-followup",
                json={
                    "category": category,
                    "subcategory": subcategory,
                    "missing_fields": missing_fields,
                    "language": language,
                    "conversation_history": conversation_history,
                    "collected_fields": collected_fields or {},
                },
            )
            resp.raise_for_status()
            return resp.json()["message"]
        except Exception:
            logger.exception("LLM followup call failed")
            return self._fallback_followup(missing_fields, language)

    def _fallback_followup(self, missing_fields: dict[str, str], language: str) -> str:
        """Fallback when LLM followup generation fails."""
        if language == "kz":
            prefix = "Өтінішіңізді өңдеу үшін мына ақпарат қажет:"
        elif language == "en":
            prefix = "To process your request, we need the following information:"
        else:
            prefix = "Для обработки вашего обращения нам нужна следующая информация:"

        items = "\n".join(f"- {desc}" for desc in missing_fields.values())
        return f"{prefix}\n{items}"
