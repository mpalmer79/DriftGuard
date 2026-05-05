"""Prometheus metrics registry (Phase 4.2).

The metric set listed in the Phase 4 directive:

- ``sentinel_simulation_steps_total{simulation_id}``
- ``sentinel_decisions_total{mode, action}``
- ``sentinel_vote_outcome_total{outcome}``
- ``sentinel_faults_active{type, target}``
- ``sentinel_controller_health{controller_id, status}``
- ``sentinel_step_duration_seconds`` (histogram)
- ``sentinel_replay_fingerprint{simulation_id}`` (info)

Notes on cardinality (documented in ``docs/OBSERVABILITY.md``):

The directive labels two metrics by ``simulation_id``, which is
unbounded across long runs. For a portfolio simulation this is fine
because operators clear the registry between deploys; in a real
deployment we would either bucket by scenario name or route the
per-simulation series through an exemplar-on-counter pattern.
"""

from __future__ import annotations

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    Info,
    generate_latest,
)

# A dedicated registry so test isolation is straightforward — tests can
# call ``reset_registry()`` to start clean. Using the global default
# registry would interfere with parallel tests sharing the same Python
# process.
REGISTRY = CollectorRegistry()


simulation_steps_total = Counter(
    "sentinel_simulation_steps_total",
    "Number of simulation steps that have executed.",
    ["simulation_id"],
    registry=REGISTRY,
)

decisions_total = Counter(
    "sentinel_decisions_total",
    "Number of system decisions emitted, by mode and final action.",
    ["mode", "action"],
    registry=REGISTRY,
)

vote_outcome_total = Counter(
    "sentinel_vote_outcome_total",
    "Vote outcomes (CONSENSUS / SPLIT / INSUFFICIENT_DATA).",
    ["outcome"],
    registry=REGISTRY,
)

faults_active = Gauge(
    "sentinel_faults_active",
    "Number of faults currently active, by type and target.",
    ["type", "target"],
    registry=REGISTRY,
)

controller_health = Gauge(
    "sentinel_controller_health",
    "Controller health state (1 if controller currently in this state).",
    ["controller_id", "status"],
    registry=REGISTRY,
)

step_duration_seconds = Histogram(
    "sentinel_step_duration_seconds",
    "Wall-clock duration of a single simulation step.",
    buckets=(0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0),
    registry=REGISTRY,
)

replay_fingerprint = Info(
    "sentinel_replay_fingerprint",
    "Most-recent canonical timeline fingerprint per simulation id.",
    ["simulation_id"],
    registry=REGISTRY,
)


def render() -> tuple[bytes, str]:
    """Return ``(payload, content_type)`` for the /metrics endpoint."""

    return generate_latest(REGISTRY), CONTENT_TYPE_LATEST


def reset_registry() -> None:
    """Clear labeled metrics — only used in tests to keep them isolated.

    Unlabeled histograms (``step_duration_seconds``) accumulate across
    tests; tests that care assert relative observations rather than
    absolute counts. The labeled metrics expose ``.clear()`` directly.
    """

    for metric in (
        simulation_steps_total,
        decisions_total,
        vote_outcome_total,
        faults_active,
        controller_health,
        replay_fingerprint,
    ):
        metric.clear()
