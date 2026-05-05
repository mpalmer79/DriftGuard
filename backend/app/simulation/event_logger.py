from typing import Any

from ..core.ids import event_id
from ..core.logging_setup import get_logger
from ..domain.enums import EventSeverity, EventType
from ..domain.events import Event

_LOG_LEVEL = {
    EventSeverity.INFO: "info",
    EventSeverity.WARNING: "warning",
    EventSeverity.CRITICAL: "critical",
}


class EventLogger:
    """Append-only in-memory event log + parallel structured log line.

    Per Phase 4.1, every recorded ``Event`` also produces a structlog
    line whose fields mirror the dataclass plus a correlation id
    ``cid = f"{simulation_id}:{step}"`` so an operator can tail the
    log and reconstruct a step's pipeline.
    """

    def __init__(self, simulation_id: str | None = None) -> None:
        self._events: list[Event] = []
        self._simulation_id = simulation_id
        self._slog = get_logger("sentinel.event")

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
        self._emit_structured(event)
        return event

    def all(self) -> list[Event]:
        return list(self._events)

    def since(self, step: int) -> list[Event]:
        return [e for e in self._events if e.step >= step]

    def _emit_structured(self, event: Event) -> None:
        method = _LOG_LEVEL.get(event.severity, "info")
        log_call = getattr(self._slog, method)
        cid = f"{self._simulation_id}:{event.step}" if self._simulation_id else None
        log_call(
            event.message,
            simulation_id=self._simulation_id,
            step=event.step,
            component=event.component,
            type=event.type.value,
            severity=event.severity.value,
            cid=cid,
            metadata=event.metadata,
            event_id=event.event_id,
        )
