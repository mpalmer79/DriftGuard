# DriftGuard Build Notes — Overnight Expansion

This document captures what existed prior to this expansion and what the
expansion adds. It is intentionally short.

## Baseline (pre-expansion)

The repository contained a working backend implementation of DriftGuard,
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

This build pass extends the prototype. It preserves every passing
behavior. Concretely:

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

## Original execution plan

The first version of `ARCHITECTURE.md` carried a §23 "Execution Plan"
directive that read more like a build prompt than an architecture
document. That section has been retired; the work it described is
captured here for posterity.

- **Phase 1 — Domain layer.** Define the core dataclasses
  (`VehicleState`, `SensorReading`, `ControllerOutput`, `VoteResult`,
  `FaultRecord`, `SystemDecision`) and the enums that drive them
  (`Action`, `SystemMode`, `FaultType`).
- **Phase 2 — Core simulation modules.** Vehicle state update,
  noisy sensor model, three differing controllers, voting, fault
  injection, fault detection, safe-mode manager, event logger;
  each module isolated and testable.
- **Phase 3 — Orchestrator.** A central simulation service that
  runs the full control loop, enforces step ordering, applies
  faults, and produces system decisions.
- **Phase 4 — API.** FastAPI routes for creating simulations,
  stepping, injecting faults, and reading state and events.
- **Phase 5 — Persistence.** SQLite schema and repositories for each
  domain model, plus event storage.
- **Phase 6 — Testing.** Unit and integration coverage for voting,
  controller determinism, fault detection, safe-mode triggers, and
  the end-to-end simulation flow.
- **Phase 7 — Validation.** Confirm the simulation runs end-to-end,
  faults trigger expected behavior, safe mode activates correctly,
  and outputs are deterministic.

Subsequent phases (8–12) added redundant detection, scenarios,
mission reports, frontend, observability (Prometheus + OpenTelemetry
+ SSE), security/ops hardening, supply-chain CI, test expansion to
538 cases at 97% line coverage, and the portfolio polish documented
in [`CHANGELOG.md`](../CHANGELOG.md).

