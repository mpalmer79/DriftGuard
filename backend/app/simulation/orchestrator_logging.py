"""Per-stage structured event logging helpers for the orchestrator.

Each function takes the live `EventLogger` plus the relevant artifact
and emits a single event. Extracted from `orchestrator.py` so the
control loop reads as a sequence of named stages rather than a wall
of `events.log(...)` calls.
"""

from ..domain.enums import (
    EventSeverity,
    EventType,
    FaultSeverity,
    SystemMode,
    VoteOutcome,
)
from ..domain.models import (
    ControllerOutput,
    SensorReading,
    SystemDecision,
    VehicleState,
    VoteResult,
)
from .event_logger import EventLogger
from .health import DetectionFinding


def log_sensor(events: EventLogger, step: int, ts: float, sensor: SensorReading) -> None:
    severity = EventSeverity.WARNING if sensor.fault_flags else EventSeverity.INFO
    events.log(
        step=step,
        timestamp=ts,
        component="sensor",
        type=EventType.SENSOR,
        severity=severity,
        message=f"sensor status {sensor.status.value}",
        metadata={"flags": sensor.fault_flags, "confidence": sensor.confidence},
    )


def log_controller(events: EventLogger, step: int, ts: float, out: ControllerOutput) -> None:
    events.log(
        step=step,
        timestamp=ts,
        component=out.controller_id,
        type=EventType.CONTROLLER,
        severity=EventSeverity.INFO if out.valid else EventSeverity.WARNING,
        message=f"{out.controller_id} -> {out.action.value} ({out.reason_code})",
        metadata={
            "valid": out.valid,
            "response_time_ms": out.response_time_ms,
            "confidence": out.confidence,
        },
    )


def log_vote(events: EventLogger, step: int, ts: float, vote: VoteResult) -> None:
    severity = (
        EventSeverity.INFO if vote.outcome == VoteOutcome.CONSENSUS else EventSeverity.WARNING
    )
    events.log(
        step=step,
        timestamp=ts,
        component="voting",
        type=EventType.VOTE,
        severity=severity,
        message=f"vote {vote.outcome.value}: {vote.reason}",
        metadata={
            "selected": vote.selected_action.value if vote.selected_action else None,
            "agreeing": vote.agreeing_controllers,
            "rejected": vote.rejected_controllers,
        },
    )


def log_detector_warnings(
    events: EventLogger,
    step: int,
    ts: float,
    warnings: list[tuple[str, FaultSeverity, str]],
) -> None:
    for component, severity, message in warnings:
        ev_sev = (
            EventSeverity.CRITICAL if severity == FaultSeverity.CRITICAL else EventSeverity.WARNING
        )
        events.log(
            step=step,
            timestamp=ts,
            component=component,
            type=EventType.FAULT,
            severity=ev_sev,
            message=message,
            metadata={"detected_severity": severity.value},
        )


def log_trust_findings(
    events: EventLogger,
    step: int,
    ts: float,
    findings: list[DetectionFinding],
) -> None:
    for finding in findings:
        ev_sev = (
            EventSeverity.CRITICAL
            if finding.severity.value == "CRITICAL"
            else EventSeverity.WARNING
        )
        events.log(
            step=step,
            timestamp=ts,
            component=finding.component,
            type=EventType.FAULT,
            severity=ev_sev,
            message=finding.message,
            metadata={"health": finding.severity.value, **finding.metadata},
        )


def log_mode_change(
    events: EventLogger,
    step: int,
    ts: float,
    new_mode: SystemMode,
    justification: str,
) -> None:
    severity = EventSeverity.CRITICAL if new_mode == SystemMode.FAILED else EventSeverity.WARNING
    events.log(
        step=step,
        timestamp=ts,
        component="state_manager",
        type=EventType.MODE_CHANGE,
        severity=severity,
        message=f"mode -> {new_mode.value}",
        metadata={"justification": justification},
    )


def log_decision(events: EventLogger, step: int, ts: float, decision: SystemDecision) -> None:
    severity = (
        EventSeverity.INFO if decision.system_mode == SystemMode.NORMAL else EventSeverity.WARNING
    )
    events.log(
        step=step,
        timestamp=ts,
        component="orchestrator",
        type=EventType.DECISION,
        severity=severity,
        message=f"final action {decision.final_action.value}",
        metadata={
            "mode": decision.system_mode.value,
            "safe_mode_active": decision.safe_mode_active,
            "justification": decision.justification,
        },
    )


def log_state(events: EventLogger, ts: float, state: VehicleState) -> None:
    events.log(
        step=state.step,
        timestamp=ts,
        component="vehicle",
        type=EventType.STATE,
        severity=EventSeverity.INFO,
        message="state updated",
        metadata={
            "altitude": state.altitude,
            "velocity": state.velocity,
            "heading": state.heading,
            "mode": state.system_mode.value,
        },
    )
