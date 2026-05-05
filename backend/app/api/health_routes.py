"""Liveness, readiness, and metrics endpoints (Phase 4.4 / 4.2 / 7.1).

Liveness vs. readiness separation (Phase 7.1):

- ``/healthz`` — Kubernetes-style **liveness** probe. Always returns
  200 while the Python process is up and serving HTTP. Use this as
  the orchestrator's restart-on-fail probe.
- ``/readyz`` — Kubernetes-style **readiness** probe. Returns 200
  when the application's dependencies (SQLite connection, scenario
  registry) are usable; otherwise **503**. Use this to gate traffic.
- ``/health`` and ``/ready`` are preserved as operator-friendly
  aliases that always return 200 with a status field. They predate
  the split and stay reachable so existing dashboards keep working.

`/metrics` returns the Prometheus exposition format payload from
the dedicated CollectorRegistry in `core/metrics.py`.
"""

from __future__ import annotations

from fastapi import APIRouter, Response
from starlette.responses import JSONResponse

from ..core import metrics
from ..scenarios import all_scenarios
from . import dependencies as deps

router = APIRouter()


def _readiness_payload() -> tuple[bool, dict]:
    """Run the readiness probes and return (ok, body).

    Single source of truth for `/ready` (always 200, body has the
    status field) and `/readyz` (200 / 503).
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

    return ok, {"status": "ready" if ok else "not_ready", "checks": checks}


@router.get("/health")
def health() -> dict:
    """Operator-friendly liveness alias. Always 200 if the process is up."""

    return {"status": "ok"}


@router.get("/healthz")
def healthz() -> dict:
    """Kubernetes-style liveness probe. Always 200 if the process is up.

    Distinct from `/readyz` so an orchestrator can correctly tell
    the difference between "restart the pod" (liveness fails) and
    "stop sending traffic" (readiness fails).
    """

    return {"status": "ok"}


@router.get("/metrics")
def get_metrics() -> Response:
    """Prometheus exposition format. Content-type comes from the
    prom-client constant so scrapers parse it correctly."""

    payload, content_type = metrics.render()
    return Response(content=payload, media_type=content_type)


@router.get("/ready")
def ready() -> dict:
    """Operator-friendly readiness alias. Always 200; the body's
    ``status`` field distinguishes `ready` from `not_ready`.

    Dashboards that key on the body still work; pod orchestrators
    should use ``/readyz`` instead so they get a real 503 when the
    app is not ready to serve traffic.
    """

    _, body = _readiness_payload()
    return body


@router.get("/readyz")
def readyz() -> Response:
    """Kubernetes-style readiness probe.

    Returns 200 when SQLite is reachable and the scenario registry is
    populated; otherwise 503. The body carries the same per-check
    detail as ``/ready`` so an operator can diagnose without reading
    server logs.
    """

    ok, body = _readiness_payload()
    status_code = 200 if ok else 503
    return JSONResponse(status_code=status_code, content=body)
