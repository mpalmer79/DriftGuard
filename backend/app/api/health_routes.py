"""Liveness, readiness, and metrics endpoints (Phase 4.4 / 4.2).

`/health` is the liveness probe — the process is up and serving HTTP.
`/ready` is the readiness probe — the dependencies the application
needs (SQLite connection, scenario registry) are usable.
`/metrics` returns the Prometheus exposition format payload from
the dedicated CollectorRegistry in `core/metrics.py`.

Kept in a separate router so middleware (request id, future auth)
can opt in or out per route group later.
"""

from __future__ import annotations

from fastapi import APIRouter, Response

from ..core import metrics
from ..scenarios import all_scenarios
from . import dependencies as deps

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/metrics")
def get_metrics() -> Response:
    """Prometheus exposition format. Content-type comes from the
    prom-client constant so scrapers parse it correctly."""

    payload, content_type = metrics.render()
    return Response(content=payload, media_type=content_type)


@router.get("/ready")
def ready() -> dict:
    """Returns 200 only when dependencies are usable.

    Checks:
    - SQLite connectivity: a no-op query against the simulations table.
    - Scenario registry: at least one scenario is registered.

    The body explains which checks ran so an operator can diagnose a
    partial readiness without reading server logs.
    """

    checks: dict[str, str] = {}
    ok = True

    try:
        conn = deps.get_db().connect()
        conn.execute("SELECT 1 FROM simulations WHERE 1 = 0").fetchall()
        checks["database"] = "ok"
    except Exception as exc:  # pragma: no cover - exercised by readiness failure tests
        checks["database"] = f"error: {exc}"
        ok = False

    scenarios = all_scenarios()
    if scenarios:
        checks["scenarios"] = f"ok ({len(scenarios)} registered)"
    else:
        checks["scenarios"] = "error: no scenarios registered"
        ok = False

    return {"status": "ready" if ok else "not_ready", "checks": checks}
