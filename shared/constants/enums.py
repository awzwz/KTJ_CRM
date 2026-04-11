from enum import StrEnum


class UserRole(StrEnum):
    ADMIN = "admin"
    OPERATOR = "operator"
    CONTROLLER = "controller"
    BRANCH_MANAGER = "branch_manager"


class AppealCategory(StrEnum):
    GRATITUDE = "gratitude"
    LOST_ITEMS = "lost_items"
    TICKET_RETURN = "ticket_return"
    COMPLAINT = "complaint"
    SUGGESTION = "suggestion"


class AppealSubcategory(StrEnum):
    # Gratitude
    TRAIN_CREW = "train_crew"
    TICKET_CASHIER = "ticket_cashier"
    OTHER_GRATITUDE = "other_gratitude"
    # Ticket return
    RETURN_STATUS = "return_status"
    RETURN_CONSULTATION = "return_consultation"


class AppealStatus(StrEnum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    ON_REVIEW = "on_review"
    RESOLVED = "resolved"
    CLOSED = "closed"


class AppealSource(StrEnum):
    WHATSAPP = "whatsapp"
    PHONE_1433 = "phone_1433"


class MessageDirection(StrEnum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class MessageChannel(StrEnum):
    WHATSAPP = "whatsapp"
    PHONE = "phone"
    SYSTEM = "system"


class Language(StrEnum):
    RUSSIAN = "ru"
    KAZAKH = "kz"


class ShiftType(StrEnum):
    """Time-based routing for ticket returns."""
    LVRS = "lvrs"       # 08:00 - 12:00
    LVRZ = "lvrz"       # 12:00 - 16:00
    LVRNO = "lvrno"     # 18:00 - 20:00
