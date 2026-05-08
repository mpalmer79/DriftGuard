# Observability

DriftGuard emits three observability signals: events (the audit
log, source of truth), metrics (Prometheus, for monitoring), and
traces (OpenTelemetry, for diagnosing per-step latency and call
order). Plus a request id woven through HTTP responses and logs.

The signals do not replace each other:

- **Events** are persisted to SQLite and are the source of truth
  for replay and the mission report. RESEARCH.md §5.5 calls this
  out as the audit-grade artifact.
- **Metrics** are aggregated for dashboards and alerts.
- **Traces** are sampled diagnostic detail for an individual run.

## Event → metric → log map

Every audit event the orchestrator emits has a parallel
structured log line and (where it represents a counted thing)
contributes to a metric. The map:

| Pipeline stage | Event (`type`)    | Structured log fields                  | Metric                                                     |
| -------------- | ----------------- | -------------------------------------- | ---------------------------------------------------------- |
| Sensor read    | `SENSOR`          | sensor flags, confidence               | (none — event count is the audit signal)                   |
| Controller     | `CONTROLLER`      | controller_id, valid, response_time_ms | `sentinel_controller_health{controller_id, status}` (gauge) |
| Vote           | `VOTE`            | outcome, agreeing, rejected            | `sentinel_vote_outcome_total{outcome}` (counter)            |
| Detection      | `FAULT`           | severity, message                      | `sentinel_faults_active{type, target}` (gauge)              |
| Mode change    | `MODE_CHANGE`     | justification                          | (transitions visible in `sentinel_decisions_total`)         |
| Decision       | `DECISION`        | mode, action, justification            | `sentinel_decisions_total{mode, action}` (counter)          |
| Persistence    | `STATE`           | altitude, velocity, heading, mode      | (state appears in trajectory; not metricized)               |
| Step lifecycle | (multiple above)  | (parallel structured logs)             | `sentinel_simulation_steps_total{simulation_id}`, `sentinel_step_duration_seconds` (histogram) |

## Structured logs (Phase 4.1)

Every `EventLogger.log` call also emits a structlog line. Format
is JSON by default and `console` for dev:

```bash
SENTINEL_LOG_FORMAT=console SENTINEL_LOG_LEVEL=INFO uvicorn app.main:app --reload
```

Each log line carries:

- `timestamp` (UTC, ISO-8601), `level` (info / warning / critical),
  `event` (the human-readable message)
- `simulation_id`, `step`, `component`, `type`, `severity`
- `cid` — correlation id, `f"{simulation_id}:{step}"`
- `event_id` (UUID), `metadata` (the event's metadata dict)
- `request_id` — when the event is emitted from inside an HTTP
  handler, threaded through a contextvar from the request-id
  middleware (Phase 4.5)

A failure to emit the log line never drops the audit record:
`EventLogger` appends to the in-memory list before calling structlog.

## Metrics (Phase 4.2)

`GET /metrics` returns Prometheus exposition format. The metrics:

| Name                                                 | Type      | Labels                  |
| ---------------------------------------------------- | --------- | ----------------------- |
| `sentinel_simulation_steps_total`                    | counter   | `simulation_id`         |
| `sentinel_decisions_total`                           | counter   | `mode`, `action`        |
| `sentinel_vote_outcome_total`                        | counter   | `outcome`               |
| `sentinel_faults_active`                             | gauge     | `type`, `target`        |
| `sentinel_controller_health`                         | gauge     | `controller_id`, `status` (1 = current) |
| `sentinel_step_duration_seconds`                     | histogram | (none)                  |
| `sentinel_replay_fingerprint`                        | info      | `simulation_id`         |

### Cardinality note

`sentinel_simulation_steps_total` and `sentinel_replay_fingerprint`
both use `simulation_id` as a label. Simulation IDs are unbounded.
For a portfolio simulation this is acceptable because:

- The CollectorRegistry is in-process; restarting the backend
  clears it.
- The directive labels them by `simulation_id` deliberately so a
  scraper can attribute steps to a specific run.

In a real deployment the proper move would be to emit a per-run
`info` metric and roll up steps by scenario name; that is tracked
in `docs/BACKLOG.md` for if the project ever leaves the portfolio
context.

## Tracing (Phase 4.3)

OpenTelemetry tracing is opt-in. Set `SENTINEL_TRACING=1` to install
the SDK with a console span exporter; otherwise `tracer()` is a
no-op. Each simulation step produces a span tree:

```
step (sim.id, step)
├── sensor
├── controllers
│   ├── controller_a
│   ├── controller_b
│   └── controller_c
├── vote
├── detection
├── decision
└── persistence
```

The tracer is **observability evidence**, never on the decision
path. Adding a real collector (OTLP gRPC, Jaeger, etc.) is a
deployment-time concern; the spans exist regardless.

## Health and readiness (Phase 4.4 / 7.1)

| Endpoint   | Status code            | Use                                                    |
| ---------- | ---------------------- | ------------------------------------------------------ |
| `/healthz` | `200` (always)         | Kubernetes-style liveness probe                        |
| `/readyz`  | `200` ready / `503` not | Kubernetes-style readiness probe                       |
| `/health`  | `200` (always)         | Operator-friendly liveness alias                       |
| `/ready`   | `200` always; body has `status` | Operator-friendly readiness alias                |
| `/metrics` | `200`                  | Prometheus scrape target                               |

Phase 7.1 split the liveness and readiness probes into the
Kubernetes-style `/healthz` and `/readyz` endpoints so an
orchestrator can distinguish "restart the pod" (liveness fails)
from "stop sending traffic" (readiness fails). `/readyz` returns
**503** when SQLite is unreachable or the scenario registry is
empty, which is what pod orchestrators expect.

The legacy `/health` and `/ready` paths stay reachable as
operator-friendly aliases — `/ready` always returns 200 with a
`status` field in the body, so existing dashboards that key on the
body keep working. The Compose and Docker healthchecks both probe
`/readyz` (Phase 7.1).

## Known limits

These are the operability boundaries of the current single-replica
deployment. They are intentional — the project is portfolio-scoped —
but worth knowing before you put a real load on it.

- **In-memory simulation registry.** `app/api/dependencies.py` keeps
  active simulations in a per-process dict (LRU-evicted at
  `MAX_REGISTRY_SIZE = 100`). A multi-replica deployment shards
  simulations across replicas; the registry is **not** consistent
  between them. Persisted SQLite is single-writer.
- **In-memory rate limiter.** `app/api/rate_limit.py` is per-process.
  Multi-replica deployments need a shared store (Redis) for the
  bucket counters to be effective. Today's value is dev-grade DoS
  protection on a single replica.
- **Prometheus `simulation_id` cardinality.** Bounded by
  `MAX_REGISTRY_SIZE = 100` in-process plus all persisted simulation
  IDs. If you keep simulations forever, the cardinality grows
  monotonically. The mitigation pattern (bucket by scenario name)
  is sketched in `core/metrics.py`; today the cardinality is small
  enough that we have not paid the engineering cost yet.

## Request id (Phase 4.5)

Every inbound HTTP request gets a `req_<16 hex>` request id, or
echoes the supplied `X-Request-Id`. The id appears:

- In the response `X-Request-Id` header (round trip).
- In every structured log line emitted while handling that
  request (via the `current_request_id` contextvar).

Outside an HTTP request (CLI, scripts, tests calling the
orchestrator directly) the id field is absent from logs.

## Re-running the determinism audit

Determinism is the property the observability stack helps you
verify. The `/simulations/{id}/replay-fingerprint` endpoint
(Phase 1.4) returns a SHA-256 of the canonical timeline and is the
fastest way to confirm that two runs of the same scenario produced
the same evidence. Cross-process equivalence is pinned by
`tests/test_determinism.py::test_cross_process_equivalence`.
