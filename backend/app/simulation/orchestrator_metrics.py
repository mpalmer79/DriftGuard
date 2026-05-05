"""Per-step metrics emission (Phase 4.2).

Each function takes the live ``Simulation`` plus the per-step
artifacts and pokes the relevant Prometheus metric. Extracted from
``orchestrator.py`` so the control loop reads as a sequence of
named stages and ``orchestrator.py`` stays under the file-size
ceiling (ADR equivalents on the principal-hardening directive).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from ..core import metrics
from ..domain.enums import HealthStatus
from ..domain.models import FaultRecord, SystemDecision, VoteResult

if TYPE_CHECKING:
    from .health import TrustDetector

_ALL_HEALTH_STATUSES = tuple(s.value for s in HealthStatus)


def record_vote(vote_result: VoteResult) -> None:
    metrics.vote_outcome_total.labels(outcome=vote_result.outcome.value).inc()


def record_decision(decision: SystemDecision) -> None:
    metrics.decisions_total.labels(
        mode=decision.system_mode.value,
        action=decision.final_action.value,
    ).inc()


def record_health_one_hot(trust: TrustDetector) -> None:
    """Set a one-hot indicator per (controller_id, status) pair.

    Sensor health lives in the same TrustDetector but is excluded
    here because the directive's metric label is ``controller_id``;
    sensor health surfaces through its own events instead.
    """

    for cid, comp in trust.state.components.items():
        if cid == "sensor":
            continue
        for status in _ALL_HEALTH_STATUSES:
            metrics.controller_health.labels(controller_id=cid, status=status).set(
                1.0 if comp.status.value == status else 0.0
            )


def record_active_faults(all_faults: list[FaultRecord], active: list[FaultRecord]) -> None:
    """Reset every known (type, target) gauge to zero, then re-set the
    active ones. Without the reset, gauges would carry stale values
    once a fault expires."""

    for fault in all_faults:
        metrics.faults_active.labels(type=fault.type.value, target=fault.target_component).set(0.0)
    for fault in active:
        metrics.faults_active.labels(type=fault.type.value, target=fault.target_component).inc()


def record_step_count(simulation_id: str) -> None:
    metrics.simulation_steps_total.labels(simulation_id=simulation_id).inc()


def observe_step_duration(seconds: float) -> None:
    metrics.step_duration_seconds.observe(seconds)


def record_post_step(
    *,
    simulation_id: str,
    trust: TrustDetector,
    all_faults: list[FaultRecord],
    active_faults: list[FaultRecord],
    duration_seconds: float,
) -> None:
    """Single entry point the orchestrator calls at the end of step().

    Bundles the per-step emissions so ``orchestrator.step()`` stays a
    short readable sequence.
    """

    record_health_one_hot(trust)
    record_active_faults(all_faults, active_faults)
    record_step_count(simulation_id)
    observe_step_duration(duration_seconds)
