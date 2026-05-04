from dataclasses import dataclass, field
from typing import Dict, Any

from .enums import EventType, EventSeverity


@dataclass
class Event:
    event_id: str
    step: int
    timestamp: float
    component: str
    type: EventType
    severity: EventSeverity
    message: str
    metadata: Dict[str, Any] = field(default_factory=dict)
