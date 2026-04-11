"""
All possible states in the bot conversation flow.
Mirrors the BPMN diagram for KTZh customer service.
"""
from enum import StrEnum


class BotState(StrEnum):
    # Entry
    START = "start"
    SELECT_LANGUAGE = "select_language"
    ENTER_TRAIN_NUMBER = "enter_train_number"
    ENTER_DATE = "enter_date"
    SELECT_CATEGORY = "select_category"

    # Gratitude branch
    GRATITUDE_SELECT_SUBCATEGORY = "gratitude_select_subcategory"
    GRATITUDE_TRAIN_CREW_CAR = "gratitude_train_crew_car"
    GRATITUDE_TRAIN_CREW_SEAT = "gratitude_train_crew_seat"
    GRATITUDE_TRAIN_CREW_TEXT = "gratitude_train_crew_text"
    GRATITUDE_CASHIER_STATION = "gratitude_cashier_station"
    GRATITUDE_CASHIER_NAME = "gratitude_cashier_name"
    GRATITUDE_CASHIER_TEXT = "gratitude_cashier_text"
    GRATITUDE_OTHER_TEXT = "gratitude_other_text"

    # Lost items branch
    LOST_ITEMS_CAR = "lost_items_car"
    LOST_ITEMS_SEAT = "lost_items_seat"
    LOST_ITEMS_DESCRIPTION = "lost_items_description"

    # Ticket return branch
    TICKET_RETURN_SELECT_TYPE = "ticket_return_select_type"
    TICKET_RETURN_STATUS_NUMBER = "ticket_return_status_number"
    TICKET_RETURN_STATUS_TEXT = "ticket_return_status_text"
    TICKET_RETURN_CONSULT_TEXT = "ticket_return_consult_text"

    # Complaint branch
    COMPLAINT_TEXT = "complaint_text"

    # Suggestion branch
    SUGGESTION_TEXT = "suggestion_text"

    # Terminal
    COMPLETED = "completed"
