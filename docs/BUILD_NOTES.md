# SentinelNav Build Notes — Overnight Expansion

This document captures what existed prior to this expansion and what the
expansion adds. It is intentionally short.

## Baseline (pre-expansion)

The repository contained a working backend implementation of SentinelNav,
merged via PR #1. Concretely:

- `backend/app/domain/` — enums (`Action`, `SystemMode`, `FaultType`,
  `FaultSeverity`, `SensorStatus`, `VoteOutcome`, `EventType`,
  `EventSeverity`) and dataclass models (`VehicleState`, `SensorReading`,
  `ControllerOutput`, `VoteResult`, `FaultRecord`, `SystemDecision`, `Event`).
- `backend/app/simulation/` — vehicle state engine, noisy sensor model,
  three differing controllers (Conservative, Responsive, Balanced), majority
  voting, simple counter-based fault detection, safe mode manager,
  append-only event logger, and a `Simulation` orchestrator running the
  full 13-step control loop.
- `backend/app/api/` — FastAPI routes for `POST /simulations`,
  `POST /simulations/{id}/step`, `POST /simulations/{id}/faults`,
  `GET /simulations/{id}/state`, `GET /simulations/{id}/events`.
- `backend/app/persistence/` — SQLite schema and a repository that saves
  state, sensor readings, controller outputs, votes, decisions, and events.
- `backend/app/tests/` — 29 pytest cases covering voting, controllers,
  fault detection, safe mode, simulation flow, determinism, and the API.

All 29 tests pass on `main`.

## Expansion goals

This build pass extends the prototype into a portfolio-grade platform. It
preserves every passing behavior. Concretely:

1. **Backend architecture polish** — centralized ID and timestamp helpers,
   typed application exceptions, consistent API error responses,
   `scenarios/` and `reporting/` packages.
2. **Persistent recovery** — repository read methods, list endpoints, full
   timeline reconstruction, simulations queryable from SQLite.
3. **Scenario engine** — six named built-in scenarios with deterministic
   replay, plus API routes to list and run them.
4. **Advanced fault injection** — richer fault types and metadata
   (intermittent patterns, forced actions, latency, confidence drop, etc.).
5. **Time-windowed fault detection** — sliding-window disagreement, per-
   component trust scores, escalation and recovery semantics with health
   states (`HEALTHY`, `SUSPECT`, `DEGRADED`, `CRITICAL`, `RECOVERING`).
6. **Mission report generator** — structured JSON report and a Markdown
   render derived from persisted data, exposed via API.
7. **Frontend** — Next.js + TypeScript + Tailwind app with landing,
   dashboard, scenarios, simulation detail, replay, and report pages
   wired to a typed API client.
8. **Deployment readiness** — Dockerfiles, `docker-compose.yml`, env
   examples, deployment/API/scenario/fault-model/case-study docs.
9. **Test expansion** — additional backend tests for recovery, timeline,
   scenario determinism, new faults, trust/health logic, and reports.

## Compatibility rules

- Existing 29 tests keep passing. New behavior is additive.
- Existing API routes remain at the same paths and shapes.
- `app.api.routes._simulations` registry is preserved; new endpoints fall
  back to persisted state when the registry is empty.
- The original `FaultType` enum keeps all its values; new fault behaviors
  are layered on through metadata or additional enum members.
