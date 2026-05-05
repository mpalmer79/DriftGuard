import time
from dataclasses import dataclass, field

from ..core.config import DEFAULT_CONFIG, SimulationConfig
from ..core.rng import RngService
from ..core.tracing import tracer
from ..domain.enums import (
    EventSeverity,
    EventType,
    FaultSeverity,
    FaultType,
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
from .anomaly_sidecar import AnomalySidecar, emit_advisory_event
from .controllers import Controller, default_controllers
from .detection import FaultDetector
from .dynamics.integrator import integrate_action
from .event_logger import EventLogger
from .faults import FaultRegistry
from .health import TrustDetector
from .navigation import NavigationPipeline
from .orchestrator_decision import build_decision
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
from .orchestrator_metrics import record_decision, record_post_step, record_vote
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
        # ADR 0010: opt-in navigation pipeline. Constructed unconditionally
        # so the field is always present (simplifies tests + persistence
        # serialisation), but only consulted when the flag is set.
        self.navigation = NavigationPipeline(
            sensor_rng=self.rng.child("nav_sensor"),
            ins_rng=self.rng.child("ins"),
            gps_rng=self.rng.child("gps"),
            sensor_noise_std=config.sensor_noise_std,
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
            latency_warning=config.latency_warning_threshold,
            latency_critical=config.latency_critical_threshold,
        )
        self.safe_mode = SafeModeManager(
            self.detector,
            recovery_steps=config.safe_mode_recovery_steps,
        )
        self.trust = TrustDetector(latency_threshold_ms=config.latency_threshold_ms)
        self.anomaly = AnomalySidecar(rng=self.rng.child("anomaly"))
        self.events = EventLogger(simulation_id=self.id)
        self.step_history: list[StepRecord] = []
        self.last_decision: SystemDecision | None = None

    # Resource caps (Phase 8.4). Per-simulation step ceiling and per-
    # simulation fault ceiling. Crossing either raises CapacityError,
    # which the API layer maps to HTTP 429.
    MAX_STEPS = 10_000
    MAX_FAULTS = 100

    def inject_fault(
        self,
        fault_type: FaultType,
        target: str,
        start_step: int | None = None,
        duration: int | None = None,
        severity: FaultSeverity = FaultSeverity.WARNING,
        metadata: dict | None = None,
    ) -> FaultRecord:
        from ..core.exceptions import CapacityError

        if len(self.faults.all()) >= self.MAX_FAULTS:
            raise CapacityError(f"per-simulation fault cap of {self.MAX_FAULTS} reached")
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
        from ..core.exceptions import CapacityError

        if self.state.step >= self.MAX_STEPS:
            raise CapacityError(f"per-simulation step cap of {self.MAX_STEPS} reached")
        t = tracer()
        with t.start_as_current_span(
            "step", attributes={"sim.id": self.id, "step": self.state.step + 1}
        ):
            return self._run_step(t)

    def _run_step(self, t) -> StepRecord:
        wall_start = time.monotonic()
        next_step = self.state.step + 1
        ts = self.state.timestamp + 1.0
        active_faults = self.faults.active_at(next_step)

        with t.start_as_current_span("sensor"):
            if self.config.navigation_pipeline_enabled:
                nav_output = self.navigation.step(self.state, active_faults)
                sensor = nav_output.to_sensor_reading()
            else:
                sensor = self.sensors.read(self.state, active_faults)
            sensor.step = next_step
            log_sensor(self.events, next_step, ts, sensor)

        outputs: list[ControllerOutput] = []
        with t.start_as_current_span("controllers"):
            for controller in self.controllers:
                with t.start_as_current_span(controller.id):
                    out = controller.evaluate(sensor, active_faults)
                    outputs.append(out)
                    log_controller(self.events, next_step, ts, out)

        with t.start_as_current_span("vote"):
            vote_result = vote(outputs, latency_threshold_ms=self.config.latency_threshold_ms)
            log_vote(self.events, next_step, ts, vote_result)
            record_vote(vote_result)

        with t.start_as_current_span("detection"):
            warnings = self.detector.update(outputs, vote_result, sensor)
            log_detector_warnings(self.events, next_step, ts, warnings)
            findings = self.trust.update(outputs, vote_result, sensor)
            log_trust_findings(self.events, next_step, ts, findings)

        with t.start_as_current_span("decision"):
            new_mode, justification = self.safe_mode.evaluate(vote_result, sensor)
            if self.safe_mode.transition(new_mode):
                log_mode_change(self.events, next_step, ts, new_mode, justification)
            decision = build_decision(next_step, vote_result, new_mode, justification)
            log_decision(self.events, next_step, ts, decision)
            record_decision(decision)

        with t.start_as_current_span("persistence"):
            if self.config.use_substep_integrator:
                # Phase 2.1: opt-in continuous-time integrator. Default
                # off — see ADR 0007. The legacy `apply_action` is
                # what the replay-fingerprint contract pins.
                new_state = integrate_action(
                    self.state,
                    decision.final_action,
                    substeps=self.config.integrator_substeps,
                )
            else:
                new_state = apply_action(self.state, decision.final_action)
            new_state.system_mode = new_mode
            self.state = new_state
            log_state(self.events, self.state.timestamp, self.state)

        emit_advisory_event(self.events, self.anomaly, next_step, ts, outputs, sensor)

        record_post_step(
            simulation_id=self.id,
            trust=self.trust,
            all_faults=self.faults.all(),
            active_faults=active_faults,
            duration_seconds=time.monotonic() - wall_start,
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

    def run(self, steps: int) -> list[StepRecord]:
        return [self.step() for _ in range(steps)]
