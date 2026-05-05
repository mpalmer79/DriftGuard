"""Anomaly sidecar: warm-up window + per-step advisory scoring.

Wraps the isolation forest with the orchestration logic the
orchestrator needs:

- Buffer the first ``warmup_size`` feature vectors.
- Fit the forest once warm-up is complete.
- Score every subsequent step and bucket the score into a severity.
- Expose the rolling list of (step, score, severity) triples for the
  mission-report comparison summary (Phase 6.3).

Per ADR 0009 this module emits **events only**. It does not import
or call the safe-mode manager, voting engine, or any decision-path
detector.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field

from ..domain.enums import EventSeverity
from .anomaly import IsolationForest

# Score-to-severity bands. Tuned so a no-fault scenario stays at
# INFO (the small warm-up window in this project produces a narrow
# but elevated baseline) and a clear fault crosses CRITICAL within
# a few steps.
_WARNING_THRESHOLD = 0.72
_CRITICAL_THRESHOLD = 0.85


@dataclass
class AnomalyScore:
    step: int
    score: float
    severity: EventSeverity


@dataclass
class AnomalySidecar:
    rng: random.Random
    warmup_size: int = 10
    _forest: IsolationForest = field(init=False)
    _buffer: list[list[float]] = field(default_factory=list)
    _scores: list[AnomalyScore] = field(default_factory=list)

    def __post_init__(self) -> None:
        self._forest = IsolationForest(rng=self.rng)

    @property
    def fitted(self) -> bool:
        return self._forest.fitted

    @property
    def scores(self) -> list[AnomalyScore]:
        return list(self._scores)

    def observe(self, step: int, features: list[float]) -> AnomalyScore | None:
        """Buffer during warm-up; return a score after.

        Returns ``None`` while still warming up so the orchestrator
        knows to skip emitting an event.
        """

        if not self._forest.fitted:
            self._buffer.append(features)
            if len(self._buffer) >= self.warmup_size:
                self._forest.fit(self._buffer)
            return None
        score = self._forest.score(features)
        record = AnomalyScore(step=step, score=score, severity=_severity_for(score))
        self._scores.append(record)
        return record


def _severity_for(score: float) -> EventSeverity:
    if score >= _CRITICAL_THRESHOLD:
        return EventSeverity.CRITICAL
    if score >= _WARNING_THRESHOLD:
        return EventSeverity.WARNING
    return EventSeverity.INFO


def emit_advisory_event(events, sidecar, step: int, ts: float, outputs, sensor) -> None:
    """Run the sidecar for one step and emit an event if it scored.

    The orchestrator calls this so the file size stays tight and so
    the per-step plumbing (event_logger.log signature, EventType
    constant) lives next to the sidecar that needs it.
    """

    from ..domain.enums import EventType

    score = sidecar.observe(step, features_for(outputs, sensor))
    if score is None:
        return
    events.log(
        step=step,
        timestamp=ts,
        component="anomaly",
        type=EventType.FAULT,
        severity=score.severity,
        message=f"anomaly score {score.score:.3f}",
        metadata={"score": score.score, "advisory": True},
    )


def features_from_step(
    sensor_altitude: float,
    sensor_velocity: float,
    sensor_confidence: float,
    response_times_ms: list[float],
    confidences: list[float],
    valid_flags: list[bool],
) -> list[float]:
    """Pack a step's salient signals into a fixed-size feature vector.

    Order is stable so warm-up rows and live rows match. Includes:
    sensor altitude / velocity / confidence; mean and max controller
    response time; mean controller confidence; invalid-output count.
    """

    if response_times_ms:
        mean_rt = sum(response_times_ms) / len(response_times_ms)
        max_rt = max(response_times_ms)
    else:
        mean_rt = 0.0
        max_rt = 0.0
    mean_conf = sum(confidences) / len(confidences) if confidences else 0.0
    invalid = float(sum(1 for v in valid_flags if not v))
    return [
        sensor_altitude,
        sensor_velocity,
        sensor_confidence,
        mean_rt,
        max_rt,
        mean_conf,
        invalid,
    ]


def features_for(record_outputs, sensor) -> list[float]:
    """Pack a step's record into the anomaly feature vector.

    Lives here (not in anomaly.py) so the import surface that
    detector code uses stays narrow: anomaly.py never imports
    SensorReading or ControllerOutput types.
    """

    return features_from_step(
        sensor_altitude=sensor.altitude,
        sensor_velocity=sensor.velocity,
        sensor_confidence=sensor.confidence,
        response_times_ms=[o.response_time_ms for o in record_outputs],
        confidences=[o.confidence for o in record_outputs],
        valid_flags=[o.valid for o in record_outputs],
    )
