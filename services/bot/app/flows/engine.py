"""
Bot conversation engine — processes incoming messages and transitions between states.
Implements the full BPMN flow from the KTZh diagram.
"""
import logging
from datetime import datetime

from app.flows.states import BotState
from app.flows.messages import get_message
from app.flows.session import SessionManager

logger = logging.getLogger(__name__)


class BotEngine:
    def __init__(self, session_manager: SessionManager):
        self.sessions = session_manager

    async def process_message(self, phone: str, text: str) -> list[str]:
        """
        Process an incoming message from a user.
        Returns a list of response messages to send back.
        """
        session = await self.sessions.get(phone)
        if session is None:
            session = await self.sessions.create(phone)

        state = BotState(session["state"])
        lang = session.get("language", "ru")
        data = session.get("data", {})
        responses: list[str] = []

        if state == BotState.START:
            session["state"] = BotState.SELECT_LANGUAGE
            responses.append(get_message("ru", "welcome"))

        elif state == BotState.SELECT_LANGUAGE:
            responses, session = await self._handle_language(text, session, data)

        elif state == BotState.ENTER_TRAIN_NUMBER:
            responses, session = await self._handle_train_number(text, lang, session, data)

        elif state == BotState.ENTER_DATE:
            responses, session = await self._handle_date(text, lang, session, data)

        elif state == BotState.SELECT_CATEGORY:
            responses, session = await self._handle_category(text, lang, session, data)

        # === Gratitude branch ===
        elif state == BotState.GRATITUDE_SELECT_SUBCATEGORY:
            responses, session = await self._handle_gratitude_sub(text, lang, session, data)

        elif state == BotState.GRATITUDE_TRAIN_CREW_CAR:
            responses, session = await self._handle_number_input(
                text, lang, session, data, "car_number",
                BotState.GRATITUDE_TRAIN_CREW_SEAT, "gratitude_train_crew_seat"
            )

        elif state == BotState.GRATITUDE_TRAIN_CREW_SEAT:
            responses, session = await self._handle_number_input(
                text, lang, session, data, "seat_number",
                BotState.GRATITUDE_TRAIN_CREW_TEXT, "gratitude_train_crew_text"
            )

        elif state == BotState.GRATITUDE_TRAIN_CREW_TEXT:
            data["client_message"] = text
            data["subcategory"] = "train_crew"
            session["data"] = data
            session["state"] = BotState.COMPLETED
            responses.append(get_message(lang, "auto_reply_gratitude"))

        elif state == BotState.GRATITUDE_CASHIER_STATION:
            data["station_name"] = text.strip()
            session["data"] = data
            session["state"] = BotState.GRATITUDE_CASHIER_NAME
            responses.append(get_message(lang, "gratitude_cashier_name"))

        elif state == BotState.GRATITUDE_CASHIER_NAME:
            data["cashier_name"] = text.strip()
            session["data"] = data
            session["state"] = BotState.GRATITUDE_CASHIER_TEXT
            responses.append(get_message(lang, "gratitude_cashier_text"))

        elif state == BotState.GRATITUDE_CASHIER_TEXT:
            data["client_message"] = text
            data["subcategory"] = "ticket_cashier"
            session["data"] = data
            session["state"] = BotState.COMPLETED
            responses.append(get_message(lang, "auto_reply_gratitude"))

        elif state == BotState.GRATITUDE_OTHER_TEXT:
            data["client_message"] = text
            data["subcategory"] = "other_gratitude"
            session["data"] = data
            session["state"] = BotState.COMPLETED
            responses.append(get_message(lang, "auto_reply_gratitude"))

        # === Lost items branch ===
        elif state == BotState.LOST_ITEMS_CAR:
            responses, session = await self._handle_number_input(
                text, lang, session, data, "car_number",
                BotState.LOST_ITEMS_SEAT, "lost_items_seat"
            )

        elif state == BotState.LOST_ITEMS_SEAT:
            responses, session = await self._handle_number_input(
                text, lang, session, data, "seat_number",
                BotState.LOST_ITEMS_DESCRIPTION, "lost_items_description"
            )

        elif state == BotState.LOST_ITEMS_DESCRIPTION:
            data["item_description"] = text
            data["client_message"] = text
            session["data"] = data
            session["state"] = BotState.COMPLETED
            responses.append(get_message(lang, "auto_reply"))

        # === Ticket return branch ===
        elif state == BotState.TICKET_RETURN_SELECT_TYPE:
            responses, session = await self._handle_ticket_return_type(text, lang, session, data)

        elif state == BotState.TICKET_RETURN_STATUS_NUMBER:
            data["ticket_number"] = text.strip()
            session["data"] = data
            session["state"] = BotState.TICKET_RETURN_STATUS_TEXT
            responses.append(get_message(lang, "ticket_return_status_text"))

        elif state == BotState.TICKET_RETURN_STATUS_TEXT:
            data["client_message"] = text
            data["subcategory"] = "return_status"
            session["data"] = data
            session["state"] = BotState.COMPLETED
            responses.append(get_message(lang, "auto_reply"))

        elif state == BotState.TICKET_RETURN_CONSULT_TEXT:
            data["client_message"] = text
            data["subcategory"] = "return_consultation"
            session["data"] = data
            session["state"] = BotState.COMPLETED
            responses.append(get_message(lang, "auto_reply"))

        # === Complaint branch ===
        elif state == BotState.COMPLAINT_TEXT:
            data["client_message"] = text
            session["data"] = data
            session["state"] = BotState.COMPLETED
            responses.append(get_message(lang, "auto_reply"))

        # === Suggestion branch ===
        elif state == BotState.SUGGESTION_TEXT:
            data["client_message"] = text
            session["data"] = data
            session["state"] = BotState.COMPLETED
            responses.append(get_message(lang, "auto_reply"))

        elif state == BotState.COMPLETED:
            # User sent another message after completion — start new session
            session = await self.sessions.create(phone)
            session["state"] = BotState.SELECT_LANGUAGE
            responses.append(get_message("ru", "welcome"))

        await self.sessions.save(phone, session)
        return responses

    async def get_completed_data(self, phone: str) -> dict | None:
        """If session is in COMPLETED state, return collected data and delete session."""
        session = await self.sessions.get(phone)
        if session is None:
            return None
        if session.get("state") != BotState.COMPLETED:
            return None

        result = {
            "phone": session["phone"],
            "language": session.get("language", "ru"),
            **session.get("data", {}),
        }
        await self.sessions.delete(phone)
        return result

    # --- Handlers ---

    async def _handle_language(self, text: str, session: dict, data: dict):
        text = text.strip()
        if text in ("1", "русский"):
            session["language"] = "ru"
        elif text in ("2", "қазақша", "казахский"):
            session["language"] = "kz"
        else:
            return [get_message("ru", "invalid_option")], session

        lang = session["language"]
        session["state"] = BotState.ENTER_TRAIN_NUMBER
        return [get_message(lang, "enter_train_number")], session

    async def _handle_train_number(self, text: str, lang: str, session: dict, data: dict):
        text = text.strip()
        if not text.isdigit():
            return [get_message(lang, "invalid_number")], session

        data["train_number"] = int(text)
        session["data"] = data
        session["state"] = BotState.ENTER_DATE
        return [get_message(lang, "enter_date")], session

    async def _handle_date(self, text: str, lang: str, session: dict, data: dict):
        text = text.strip()
        parsed = None
        for fmt in ("%d.%m.%Y", "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
            try:
                parsed = datetime.strptime(text, fmt).date()
                break
            except ValueError:
                continue

        if parsed is None:
            return [get_message(lang, "invalid_date")], session

        data["event_date"] = parsed.isoformat()
        session["data"] = data
        session["state"] = BotState.SELECT_CATEGORY
        return [get_message(lang, "select_category")], session

    async def _handle_category(self, text: str, lang: str, session: dict, data: dict):
        text = text.strip()
        category_map = {
            "1": ("gratitude", BotState.GRATITUDE_SELECT_SUBCATEGORY, "gratitude_select_subcategory"),
            "2": ("lost_items", BotState.LOST_ITEMS_CAR, "lost_items_car"),
            "3": ("ticket_return", BotState.TICKET_RETURN_SELECT_TYPE, "ticket_return_select_type"),
            "4": ("complaint", BotState.COMPLAINT_TEXT, "complaint_text"),
            "5": ("suggestion", BotState.SUGGESTION_TEXT, "suggestion_text"),
        }

        if text not in category_map:
            return [get_message(lang, "invalid_option")], session

        category, next_state, msg_key = category_map[text]
        data["category"] = category
        session["data"] = data
        session["state"] = next_state
        return [get_message(lang, msg_key)], session

    async def _handle_gratitude_sub(self, text: str, lang: str, session: dict, data: dict):
        text = text.strip()
        sub_map = {
            "1": (BotState.GRATITUDE_TRAIN_CREW_CAR, "gratitude_train_crew_car"),
            "2": (BotState.GRATITUDE_CASHIER_STATION, "gratitude_cashier_station"),
            "3": (BotState.GRATITUDE_OTHER_TEXT, "gratitude_other_text"),
        }

        if text not in sub_map:
            return [get_message(lang, "invalid_option")], session

        next_state, msg_key = sub_map[text]
        session["state"] = next_state
        return [get_message(lang, msg_key)], session

    async def _handle_ticket_return_type(self, text: str, lang: str, session: dict, data: dict):
        text = text.strip()
        type_map = {
            "1": (BotState.TICKET_RETURN_STATUS_NUMBER, "ticket_return_status_number"),
            "2": (BotState.TICKET_RETURN_CONSULT_TEXT, "ticket_return_consult_text"),
        }

        if text not in type_map:
            return [get_message(lang, "invalid_option")], session

        next_state, msg_key = type_map[text]
        session["state"] = next_state
        return [get_message(lang, msg_key)], session

    async def _handle_number_input(
        self, text: str, lang: str, session: dict, data: dict,
        field: str, next_state: BotState, next_msg_key: str
    ):
        text = text.strip()
        if not text.isdigit():
            return [get_message(lang, "invalid_number")], session

        data[field] = int(text)
        session["data"] = data
        session["state"] = next_state
        return [get_message(lang, next_msg_key)], session
