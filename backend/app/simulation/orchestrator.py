from dataclasses import dataclass, field
from typing import Dict, List, Optional

from ..core.config import DEFAULT_CONFIG, SimulationConfig
from ..domain.enums import (
    Action,
    EventSeverity,
    EventType,
    FaultSeverity,
    FaultType,
    SystemMode,
    VoteOutcome,
)
from ..domain.events import Event
from ..domain.models import (
    ControllerOutput,
    FaultRecord,
    SensorReading,
    SystemDecision,
    VehicleState,
    VoteResult,
)
from .controllers import Controller, default_controllers
from .detection import FaultDetector
from .event_logger import EventLogger
from .faults import FaultRegistry
from .health import TrustDetector
from .safe_mode import SafeModeManager
from .sensors import SensorModel
from .vehicle import apply_action, initial_state
from .voting import vote


@dataclass
class StepRecord:
    state: VehicleState
    sensor: SensorReading
    outputs: List[ControllerOutput]
    vote: VoteResult
    decision: SystemDecision
    events: List[Event] = field(default_factory=list)


class Simulation:
    def __init__(
        self,
        simulation_id: str,
        seed: Optional[int] = None,
        config: SimulationConfig = DEFAULT_CONFIG,
        controllers: Optional[List[Controller]] = None,
    ) -> None:
        self.id = simulation_id
        self.seed = seed if seed is not None else config.default_seed
        self.config = config
        self.state = initial_state(simulation_id)
        self.sensors = SensorModel(seed=self.seed, noise_std=config.sensor_noise_std)
        self.controllers = controllers if controllers is not None else default_controllers()
        self.faults = FaultRegistry()
        self.detector = FaultDetector(
            latency_threshold_ms=config.latency_threshold_ms,
            disagreement_warning=config.disagreement_warning_threshold,
            disagreement_critical=config.disagreement_critical_threshold,
            invalid_warning=config.invalid_warning_threshold,
            invalid_critical=config.invalid_critical_threshold,
        )
        self.safe_mode = SafeModeManager(self.detector)
        self.trust = TrustDetector(latency_threshold_ms=config.latency_threshold_ms)
        self.events = EventLogger()
        self.step_history: List[StepRecord] = []
        self.last_decision: Optional[SystemDecision] = None

    def inject_fault(
        self,
        fault_type: FaultType,
        target: str,
        start_step: Optional[int] = None,
        duration: Optional[int] = None,
        severity: FaultSeverity = FaultSeverity.WARNING,
        metadata: Optional[Dict] = None,
    ) -> FaultRecord:
        if start_step is None:
            start_step = self.state.step
        record = self.faults.inject(
            fault_type=fault_type,
            target=target,
            start_step=start_step,
            duration=duration,
            severity=severity,
            metadata=metadata,
        )
        self.events.log(
            step=self.state.step,
            timestamp=self.state.timestamp,
            component="fault_injector",
            type=EventType.FAULT,
            severity=EventSeverity.WARNING,
            message=f"injected {fault_type.value} on {target}",
            metadata={
                "fault_id": record.fault_id,
                "duration": duration,
                "metadata": record.metadata,
            },
        )
        return record

    def step(self) -> StepRecord:
        next_step = self.state.step + 1
        active_faults = self.faults.active_at(next_step)

        sensor = self.sensors.read(self.state, active_faults)
        # Align reading and downstream artifacts with the step we are about to commit.
        sensor.step = next_step
        self.events.log(
            step=next_step,
            timestamp=self.state.timestamp + 1.0,
            component="sensor",
            type=EventType.SENSOR,
            severity=EventSeverity.WARNING if sensor.fault_flags else EventSeverity.INFO,
            message=f"sensor status {sensor.status.value}",
            metadata={"flags": sensor.fault_flags, "confidence": sensor.confidence},
        )

        outputs: List[ControllerOutput] = []
        for controller in self.controllers:
            out = controller.evaluate(sensor, active_faults)
            outputs.append(out)
            self.events.log(
                step=next_step,
                timestamp=self.state.timestamp + 1.0,
                component=controller.id,
                type=EventType.CONTROLLER,
                severity=EventSeverity.INFO if out.valid else EventSeverity.WARNING,
                message=f"{controller.id} -> {out.action.value} ({out.reason_code})",
                metadata={
                    "valid": out.valid,
                    "response_time_ms": out.response_time_ms,
                    "confidence": out.confidence,
                },
            )

        vote_result = vote(outputs, latency_threshold_ms=self.config.latency_threshold_ms)
        self.events.log(
            step=next_step,
            timestamp=self.state.timestamp + 1.0,
            component="voting",
            type=EventType.VOTE,
            severity=EventSeverity.INFO if vote_result.outcome == VoteOutcome.CONSENSUS else EventSeverity.WARNING,
            message=f"vote {vote_result.outcome.value}: {vote_result.reason}",
            metadata={
                "selected": vote_result.selected_action.value if vote_result.selected_action else None,
                "agreeing": vote_result.agreeing_controllers,
                "rejected": vote_result.rejected_controllers,
            },
        )

        warnings = self.detector.update(outputs, vote_result, sensor)
        for component, severity, message in warnings:
            self.events.log(
                step=next_step,
                timestamp=self.state.timestamp + 1.0,
                component=component,
                type=EventType.FAULT,
                severity=EventSeverity.CRITICAL if severity == FaultSeverity.CRITICAL else EventSeverity.WARNING,
                message=message,
                metadata={"detected_severity": severity.value},
            )

        findings = self.trust.update(outputs, vote_result, sensor)
        for finding in findings:
            self.events.log(
                step=next_step,
                timestamp=self.state.timestamp + 1.0,
                component=finding.component,
                type=EventType.FAULT,
                severity=EventSeverity.CRITICAL if finding.severity.value == "CRITICAL" else EventSeverity.WARNING,
                message=finding.message,
                metadata={"health": finding.severity.value, **finding.metadata},
            )

        new_mode, justification = self.safe_mode.evaluate(vote_result, sensor)
        mode_changed = self.safe_mode.transition(new_mode)
        if mode_changed:
            self.events.log(
                step=next_step,
                timestamp=self.state.timestamp + 1.0,
                component="state_manager",
                type=EventType.MODE_CHANGE,
                severity=EventSeverity.CRITICAL if new_mode == SystemMode.FAILED else EventSeverity.WARNING,
                message=f"mode -> {new_mode.value}",
                metadata={"justification": justification},
            )

        if vote_result.outcome == VoteOutcome.CONSENSUS and vote_result.selected_action is not None:
            chosen = vote_result.selected_action
        else:
            chosen = SafeModeManager.fallback_action(new_mode)

        final_action = SafeModeManager.restrict_action(new_mode, chosen)

        decision = SystemDecision(
            step=next_step,
            final_action=final_action,
            system_mode=new_mode,
            safe_mode_active=new_mode in (SystemMode.SAFE_MODE, SystemMode.FAILED),
            justification=justification,
            trusted_controllers=vote_result.agreeing_controllers,
            rejected_controllers=vote_result.rejected_controllers,
        )
        self.events.log(
            step=next_step,
            timestamp=self.state.timestamp + 1.0,
            component="orchestrator",
            type=EventType.DECISION,
            severity=EventSeverity.INFO if new_mode == SystemMode.NORMAL else EventSeverity.WARNING,
            message=f"final action {final_action.value}",
            metadata={
                "mode": new_mode.value,
                "safe_mode_active": decision.safe_mode_active,
                "justification": justification,
            },
        )

        new_state = apply_action(self.state, final_action)
        new_state.system_mode = new_mode
        self.state = new_state

        self.events.log(
            step=next_step,
            timestamp=self.state.timestamp,
            component="vehicle",
            type=EventType.STATE,
            severity=EventSeverity.INFO,
            message="state updated",
            metadata={
                "altitude": self.state.altitude,
                "velocity": self.state.velocity,
                "heading": self.state.heading,
                "mode": new_mode.value,
            },
        )

        record = StepRecord(
            state=self.state,
            sensor=sensor,
            outputs=outputs,
            vote=vote_result,
            decision=decision,
            events=self.events.since(next_step),
        )
        self.step_history.append(record)
        self.last_decision = decision
        return record

    def run(self, steps: int) -> List[StepRecord]:
        return [self.step() for _ in range(steps)]
