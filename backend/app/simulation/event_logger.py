import uuid
from typing import Any, Dict, List, Optional

from ..domain.enums import EventSeverity, EventType
from ..domain.events import Event


class EventLogger:
    def __init__(self) -> None:
        self._events: List[Event] = []

    def log(
        self,
        step: int,
        timestamp: float,
        component: str,
        type: EventType,
        severity: EventSeverity,
        message: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Event:
        event = Event(
            event_id=str(uuid.uuid4()),
            step=step,
            timestamp=timestamp,
            component=component,
            type=type,
            severity=severity,
            message=message,
            metadata=metadata or {},
        )
        self._events.append(event)
        return event

    def all(self) -> List[Event]:
        return list(self._events)

    def since(self, step: int) -> List[Event]:
        return [e for e in self._events if e.step >= step]
