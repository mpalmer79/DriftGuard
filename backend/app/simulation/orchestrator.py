from dataclasses import dataclass, field

from ..core.config import DEFAULT_CONFIG, SimulationConfig
from ..core.rng import RngService
from ..domain.enums import (
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
from .orchestrator_logging import (
    log_controller,
    log_decision,
    log_detector_warnings,
    log_mode_change,
    log_sensor,
    log_state,
    log_trust_findings,
    log_vote,
)
from .safe_mode import SafeModeManager
from .sensors import SensorModel
from .vehicle import apply_action, initial_state
from .voting import vote


@dataclass
class StepRecord:
    state: VehicleState
    sensor: SensorReading
    outputs: list[ControllerOutput]
    vote: VoteResult
    decision: SystemDecision
    events: list[Event] = field(default_factory=list)


class Simulation:
    def __init__(
        self,
        simulation_id: str,
        seed: int | None = None,
        config: SimulationConfig = DEFAULT_CONFIG,
        controllers: list[Controller] | None = None,
    ) -> None:
        self.id = simulation_id
        self.seed = seed if seed is not None else config.default_seed
        self.config = config
        self.rng = RngService(self.seed)
        self.state = initial_state(simulation_id)
        self.sensors = SensorModel(
            rng=self.rng.child("sensor"),
            noise_std=config.sensor_noise_std,
        )
        self.controllers = (
            controllers if controllers is not None else default_controllers(rng=self.rng)
        )
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
        self.step_history: list[StepRecord] = []
        self.last_decision: SystemDecision | None = None

    def inject_fault(
        self,
        fault_type: FaultType,
        target: str,
        start_step: int | None = None,
        duration: int | None = None,
        severity: FaultSeverity = FaultSeverity.WARNING,
        metadata: dict | None = None,
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
        ts = self.state.timestamp + 1.0
        active_faults = self.faults.active_at(next_step)

        sensor = self.sensors.read(self.state, active_faults)
        sensor.step = next_step
        log_sensor(self.events, next_step, ts, sensor)

        outputs: list[ControllerOutput] = []
        for controller in self.controllers:
            out = controller.evaluate(sensor, active_faults)
            outputs.append(out)
            log_controller(self.events, next_step, ts, out)

        vote_result = vote(outputs, latency_threshold_ms=self.config.latency_threshold_ms)
        log_vote(self.events, next_step, ts, vote_result)

        warnings = self.detector.update(outputs, vote_result, sensor)
        log_detector_warnings(self.events, next_step, ts, warnings)

        findings = self.trust.update(outputs, vote_result, sensor)
        log_trust_findings(self.events, next_step, ts, findings)

        new_mode, justification = self.safe_mode.evaluate(vote_result, sensor)
        if self.safe_mode.transition(new_mode):
            log_mode_change(self.events, next_step, ts, new_mode, justification)

        decision = _build_decision(next_step, vote_result, new_mode, justification)
        log_decision(self.events, next_step, ts, decision)

        new_state = apply_action(self.state, decision.final_action)
        new_state.system_mode = new_mode
        self.state = new_state
        log_state(self.events, self.state.timestamp, self.state)

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

    def run(self, steps: int) -> list[StepRecord]:
        return [self.step() for _ in range(steps)]


def _build_decision(
    step: int,
    vote_result: VoteResult,
    new_mode: SystemMode,
    justification: str,
) -> SystemDecision:
    if vote_result.outcome == VoteOutcome.CONSENSUS and vote_result.selected_action is not None:
        chosen = vote_result.selected_action
    else:
        chosen = SafeModeManager.fallback_action(new_mode)
    final_action = SafeModeManager.restrict_action(new_mode, chosen)
    return SystemDecision(
        step=step,
        final_action=final_action,
        system_mode=new_mode,
        safe_mode_active=new_mode in (SystemMode.SAFE_MODE, SystemMode.FAILED),
        justification=justification,
        trusted_controllers=vote_result.agreeing_controllers,
        rejected_controllers=vote_result.rejected_controllers,
    )
