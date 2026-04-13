"""
Category attribute schemas and validation logic.

Defines required fields per category/subcategory and provides
functions to check which fields are still missing from extracted data.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ExtractedData(BaseModel):
    """Union of all possible fields extractable from user messages."""

    language: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    train_number: Optional[int] = None
    car_number: Optional[int] = None
    seat_number: Optional[int] = None
    event_date: Optional[str] = None
    station_name: Optional[str] = None
    cashier_name: Optional[str] = None
    person_name: Optional[str] = None
    full_name: Optional[str] = None
    item_description: Optional[str] = None
    ticket_number: Optional[str] = None
    reason: Optional[str] = None
    delay_details: Optional[str] = None
    confidence: Optional[float] = None
    sentiment: Optional[str] = None
    summary: Optional[str] = None


# Required fields per category + subcategory.
# Structure: category -> subcategory (or "_default") -> {field: human description}
# Human descriptions are used in LLM prompts when asking for missing data.
REQUIRED_FIELDS: dict[str, dict[str, dict[str, str]]] = {
    "gratitude": {
        "train_crew": {
            "train_number": "номер поезда / train number / пойыз нөмірі",
            "car_number": "номер вагона / car number / вагон нөмірі",
            "event_date": "когда это было (дата) / when it was / қашан болды",
        },
        "ticket_cashier": {
            "station_name": "название станции / station name / стансы атауы",
            "event_date": "когда это было (дата) / when it was / қашан болды",
        },
        "other_gratitude": {
            "event_date": "когда это было (дата) / when it was / қашан болды",
        },
        "_default": {
            "train_number": "номер поезда / train number / пойыз нөмірі",
            "car_number": "номер вагона / car number / вагон нөмірі",
            "event_date": "когда это было (дата) / when it was / қашан болды",
        },
    },
    "lost_items": {
        "_default": {
            "full_name": "ваше ФИО / your full name / аты-жөніңіз",
            "train_number": "номер поезда / train number / пойыз нөмірі",
            "car_number": "номер вагона / car number / вагон нөмірі",
            "seat_number": "номер места / seat number / орын нөмірі",
            "item_description": "описание забытой вещи / lost item description / ұмытылған зат сипаттамасы",
        },
    },
    "ticket_return": {
        "_default": {
            "ticket_number": "номер билета / ticket number / билет нөмірі",
        },
    },
    "complaint": {
        "train_delay": {
            "train_number": "номер поезда / train number / пойыз нөмірі",
            "reason": "что именно произошло / what happened / не болды",
        },
        "conductor_complaint": {
            "train_number": "номер поезда / train number / пойыз нөмірі",
            "car_number": "номер вагона / car number / вагон нөмірі",
            "reason": "что именно произошло / what happened / не болды",
        },
        "service_complaint": {
            "train_number": "номер поезда / train number / пойыз нөмірі",
            "car_number": "номер вагона / car number / вагон нөмірі",
            "reason": "что именно произошло / what happened / не болды",
        },
        "_default": {
            "train_number": "номер поезда / train number / пойыз нөмірі",
            "car_number": "номер вагона / car number / вагон нөмірі",
            "reason": "что именно произошло / what happened / не болды",
        },
    },
    "suggestion": {
        "_default": {
            "reason": "ваше предложение / your suggestion / сіздің ұсынысыңыз",
        },
    },
}


def get_required_fields(
    category: str, subcategory: str | None = None
) -> dict[str, str]:
    """Return {field_name: description} for a given category + subcategory."""
    cat_map = REQUIRED_FIELDS.get(category, {})
    if subcategory and subcategory in cat_map:
        return cat_map[subcategory]
    return cat_map.get("_default", {})


def get_missing_fields(
    category: str,
    subcategory: str | None,
    extracted: dict,
) -> dict[str, str]:
    """Return {field_name: description} for fields that are still None."""
    required = get_required_fields(category, subcategory)
    return {
        field: desc
        for field, desc in required.items()
        if extracted.get(field) is None
    }
