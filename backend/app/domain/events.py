from dataclasses import dataclass, field
from typing import Any

from .enums import EventSeverity, EventType


@dataclass
class Event:
    event_id: str
    step: int
    timestamp: float
    component: str
    type: EventType
    severity: EventSeverity
    message: str
    metadata: dict[str, Any] = field(default_factory=dict)
