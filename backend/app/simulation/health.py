from collections import deque
from dataclasses import dataclass, field

from ..domain.enums import HealthStatus, SensorStatus, VoteOutcome
from ..domain.models import ControllerOutput, SensorReading, VoteResult

CONTROLLER_IDS = ("controller_a", "controller_b", "controller_c")


@dataclass
class ComponentHealth:
    component: str
    status: HealthStatus = HealthStatus.HEALTHY
    trust: float = 1.0
    fault_streak: int = 0
    clean_streak: int = 0
    repeat_count: int = 0


@dataclass
class DetectionFinding:
    component: str
    severity: HealthStatus
    message: str
    metadata: dict = field(default_factory=dict)


@dataclass
class TrustState:
    components: dict[str, ComponentHealth] = field(default_factory=dict)
    disagreement_window: deque[bool] = field(default_factory=lambda: deque(maxlen=10))
    sensor_invalid_window: deque[bool] = field(default_factory=lambda: deque(maxlen=10))


class TrustDetector:
    """Time-windowed fault detector with health states and recovery.

    Tracks per-component trust (a sliding score in [0, 1]) and a categorical
    health status. Health escalates with consecutive faults and de-escalates
    only after a cooldown of clean steps. Repeated escalation is faster.
    """

    def __init__(
        self,
        latency_threshold_ms: float,
        window: int = 10,
        suspect_threshold: int = 1,
        degraded_threshold: int = 3,
        critical_threshold: int = 5,
        recovery_steps: int = 3,
        trust_decay: float = 0.18,
        trust_recovery: float = 0.10,
    ) -> None:
        self.latency_threshold_ms = latency_threshold_ms
        self.window_size = window
        self.suspect_threshold = suspect_threshold
        self.degraded_threshold = degraded_threshold
        self.critical_threshold = critical_threshold
        self.recovery_steps = recovery_steps
        self.trust_decay = trust_decay
        self.trust_recovery = trust_recovery
        self.state = TrustState(
            disagreement_window=deque(maxlen=window),
            sensor_invalid_window=deque(maxlen=window),
        )
        for cid in CONTROLLER_IDS:
            self.state.components[cid] = ComponentHealth(component=cid)
        self.state.components["sensor"] = ComponentHealth(component="sensor")

    def update(
        self,
        outputs: list[ControllerOutput],
        vote_result: VoteResult,
        sensor: SensorReading,
    ) -> list[DetectionFinding]:
        findings: list[DetectionFinding] = []

        for out in outputs:
            misbehaving = (not out.valid) or (out.response_time_ms > self.latency_threshold_ms)
            f = self._observe(out.controller_id, misbehaving)
            if f is not None:
                findings.append(f)

        sensor_bad = sensor.status == SensorStatus.INVALID or sensor.confidence < 0.5
        f = self._observe("sensor", sensor_bad)
        if f is not None:
            findings.append(f)

        self.state.disagreement_window.append(vote_result.outcome != VoteOutcome.CONSENSUS)
        self.state.sensor_invalid_window.append(sensor.status == SensorStatus.INVALID)

        return findings

    def _observe(self, component: str, misbehaving: bool) -> DetectionFinding | None:
        h = self.state.components.setdefault(component, ComponentHealth(component=component))
        prior = h.status

        if misbehaving:
            h.fault_streak += 1
            h.clean_streak = 0
            h.trust = max(0.0, h.trust - self.trust_decay)
        else:
            h.clean_streak += 1
            if h.fault_streak > 0:
                h.fault_streak = 0
                h.repeat_count += 1
            h.trust = min(1.0, h.trust + self.trust_recovery)

        # escalate
        new_status = h.status
        scaled = max(1, self.suspect_threshold - min(2, h.repeat_count // 2))
        if h.fault_streak >= self.critical_threshold:
            new_status = HealthStatus.CRITICAL
        elif h.fault_streak >= self.degraded_threshold:
            new_status = HealthStatus.DEGRADED
        elif h.fault_streak >= scaled:
            new_status = HealthStatus.SUSPECT

        # de-escalate via recovery cooldown
        if not misbehaving and h.clean_streak >= self.recovery_steps:
            if h.status in (HealthStatus.CRITICAL, HealthStatus.DEGRADED):
                new_status = HealthStatus.RECOVERING
            elif (
                h.status == HealthStatus.RECOVERING
                and h.clean_streak >= self.recovery_steps * 2
                or h.status == HealthStatus.SUSPECT
                and h.clean_streak >= self.recovery_steps
            ):
                new_status = HealthStatus.HEALTHY

        h.status = new_status

        if new_status != prior:
            return DetectionFinding(
                component=component,
                severity=new_status,
                message=f"{component} {prior.value} -> {new_status.value}",
                metadata={
                    "trust": round(h.trust, 3),
                    "fault_streak": h.fault_streak,
                    "clean_streak": h.clean_streak,
                    "repeat_count": h.repeat_count,
                },
            )
        return None

    def disagreement_rate(self) -> float:
        if not self.state.disagreement_window:
            return 0.0
        return sum(1 for x in self.state.disagreement_window if x) / len(
            self.state.disagreement_window
        )

    def unhealthy_controllers(self) -> list[str]:
        return [
            cid
            for cid in CONTROLLER_IDS
            if self.state.components[cid].status
            in (HealthStatus.SUSPECT, HealthStatus.DEGRADED, HealthStatus.RECOVERING)
        ]

    def critical_controllers(self) -> list[str]:
        return [
            cid
            for cid in CONTROLLER_IDS
            if self.state.components[cid].status == HealthStatus.CRITICAL
        ]

    def degraded_controllers(self) -> list[str]:
        return [
            cid
            for cid in CONTROLLER_IDS
            if self.state.components[cid].status == HealthStatus.DEGRADED
        ]

    def sensor_health(self) -> ComponentHealth:
        return self.state.components["sensor"]

    def snapshot(self) -> dict[str, dict]:
        out: dict[str, dict] = {}
        for cid, h in self.state.components.items():
            out[cid] = {
                "status": h.status.value,
                "trust": round(h.trust, 3),
                "fault_streak": h.fault_streak,
                "clean_streak": h.clean_streak,
                "repeat_count": h.repeat_count,
            }
        out["_global"] = {"disagreement_rate": round(self.disagreement_rate(), 3)}
        return out
