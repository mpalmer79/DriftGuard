from collections import defaultdict
from dataclasses import dataclass, field

from ..domain.enums import FaultSeverity, SensorStatus, VoteOutcome
from ..domain.models import ControllerOutput, SensorReading, VoteResult


@dataclass
class FaultDetectionState:
    invalid_counts: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    latency_counts: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    disagreement_count: int = 0
    sensor_invalid_count: int = 0
    last_warnings: list[str] = field(default_factory=list)


class FaultDetector:
    def __init__(
        self,
        latency_threshold_ms: float,
        disagreement_warning: int,
        disagreement_critical: int,
        invalid_warning: int,
        invalid_critical: int,
        latency_warning: int | None = None,
        latency_critical: int | None = None,
    ) -> None:
        self.latency_threshold_ms = latency_threshold_ms
        self.dis_warn = disagreement_warning
        self.dis_crit = disagreement_critical
        self.inv_warn = invalid_warning
        self.inv_crit = invalid_critical
        # Phase 5.2: latency violations bucket independently from
        # invalid outputs. Default to the invalid_* thresholds so a
        # caller that hasn't been updated yet keeps the legacy
        # behaviour exactly.
        self.lat_warn = invalid_warning if latency_warning is None else latency_warning
        self.lat_crit = invalid_critical if latency_critical is None else latency_critical
        self.state = FaultDetectionState()

    def update(
        self,
        outputs: list[ControllerOutput],
        vote_result: VoteResult,
        sensor: SensorReading,
    ) -> list[tuple[str, FaultSeverity, str]]:
        warnings: list[tuple[str, FaultSeverity, str]] = []

        for out in outputs:
            if not out.valid:
                self.state.invalid_counts[out.controller_id] += 1
            if out.response_time_ms > self.latency_threshold_ms:
                self.state.latency_counts[out.controller_id] += 1

        if vote_result.outcome != VoteOutcome.CONSENSUS:
            self.state.disagreement_count += 1

        if sensor.status == SensorStatus.INVALID:
            self.state.sensor_invalid_count += 1

        for cid, count in self.state.invalid_counts.items():
            if count == self.inv_crit:
                warnings.append((cid, FaultSeverity.CRITICAL, "repeated invalid outputs"))
            elif count == self.inv_warn:
                warnings.append((cid, FaultSeverity.WARNING, "invalid outputs"))

        for cid, count in self.state.latency_counts.items():
            if count == self.lat_crit:
                warnings.append((cid, FaultSeverity.CRITICAL, "repeated latency violations"))
            elif count == self.lat_warn:
                warnings.append((cid, FaultSeverity.WARNING, "latency violations"))

        if self.state.disagreement_count == self.dis_crit:
            warnings.append(("voting", FaultSeverity.CRITICAL, "sustained disagreement"))
        elif self.state.disagreement_count == self.dis_warn:
            warnings.append(("voting", FaultSeverity.WARNING, "disagreement trend"))

        self.state.last_warnings = [f"{c}:{s.value}:{m}" for c, s, m in warnings]
        return warnings

    def unhealthy_controllers(self) -> list[str]:
        result: list[str] = []
        for cid in set(
            list(self.state.invalid_counts.keys()) + list(self.state.latency_counts.keys())
        ):
            inv = self.state.invalid_counts.get(cid, 0)
            lat = self.state.latency_counts.get(cid, 0)
            # Phase 5.2: each count bucket against its own threshold.
            if inv >= self.inv_warn or lat >= self.lat_warn:
                result.append(cid)
        return result

    def critical_controllers(self) -> list[str]:
        result: list[str] = []
        for cid in set(
            list(self.state.invalid_counts.keys()) + list(self.state.latency_counts.keys())
        ):
            inv = self.state.invalid_counts.get(cid, 0)
            lat = self.state.latency_counts.get(cid, 0)
            if inv >= self.inv_crit or lat >= self.lat_crit:
                result.append(cid)
        return result
