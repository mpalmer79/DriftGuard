from typing import Any

from ..core.ids import event_id
from ..domain.enums import EventSeverity, EventType
from ..domain.events import Event


class EventLogger:
    def __init__(self) -> None:
        self._events: list[Event] = []

    def log(
        self,
        step: int,
        timestamp: float,
        component: str,
        type: EventType,
        severity: EventSeverity,
        message: str,
        metadata: dict[str, Any] | None = None,
    ) -> Event:
        event = Event(
            event_id=event_id(),
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

    def all(self) -> list[Event]:
        return list(self._events)

    def since(self, step: int) -> list[Event]:
        return [e for e in self._events if e.step >= step]
