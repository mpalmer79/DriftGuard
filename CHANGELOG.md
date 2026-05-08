# Changelog

> **Note:** this repository was renamed from SentinelNav to DriftGuard.
> Historical references below are preserved for archival accuracy.

All notable changes are recorded here. Dates are the merge date of the
phase PR into `main`. Sub-phases are atomic conventional commits; this
changelog rolls them up by phase.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/)
and [Semantic Versioning](https://semver.org/) — the project pre-1.0,
so minor bumps absorb feature work and breaking changes are called out
in the relevant phase notes.

## [Unreleased]

## [0.3.0] — 2026-05-05

A senior review pass. The 0.2.0 → 0.3.0 release rolls up the
action plan in `CLAUDE.md` (Phases 0 → 8): cleanup of
`ARCHITECTURE.md`, claim audits of `README.md` + the portfolio case
study, the navigation-pipeline (INS+GPS+EKF) wiring, the
dynamics-integrator config flag, safe-mode recovery hysteresis,
env-driven SQLite persistence, security polish, frontend tooling,
the auth proxy, and `/healthz` / `/readyz` separation.

### Phase 0 — Cleanup baseline

- **0.1** `ARCHITECTURE.md` §23 ("Execution Plan / Definition of
  Done") removed; replaced with a build-history pointer to
  `docs/BUILD_NOTES.md`. Original phase narrative preserved in
  BUILD_NOTES under "Original execution plan".
- **0.2** README + portfolio case study claim audit. Three claims
  softened to match what runs today, ahead of the wiring landing in
  Phases 1–3.

### Phase 1 — Navigation pipeline (INS / GPS / EKF) on the live path

- **1.1** **ADR 0010** — *Wire INS / GPS / EKF into the orchestrator
  step loop.* Captures the policy: faults inject onto pipeline
  inputs, not the EKF output; staged migration via flag; the only
  authorised replay-fingerprint reset in this plan.
- **1.2** New `simulation/navigation.py` exposes `NavigationPipeline`
  (INS + GPS + EKF). Opt-in behind
  `SimulationConfig.navigation_pipeline_enabled` (default `False` in
  this PR). 9 unit tests covering converge-without-faults,
  GPS-dropout-still-produces-estimate, sensor-fault-flag-propagates,
  determinism under repeated seed.
- **1.3** Default flipped to `True`. Three new orchestrator-level
  integration tests pin GPS-denial recovery (variance grows under
  denial, shrinks once GPS returns), spike attenuation across a
  multi-step window with a GPS-aided step, and the sanity check that
  every `StepRecord.sensor` now comes from the pipeline. Two
  existing tests adjusted with explicit `# Phase 1.3` loosening
  comments. Replay-fingerprint reset authorised by ADR 0010.
- **1.4** README + portfolio claims re-strengthened: the EKF
  pipeline runs by default and the case study has a
  "Why GPS-denial earns its place" subsection.

### Phase 2 — Dynamics integrator config flag

- **2.1** `SimulationConfig.use_substep_integrator` (default
  `False`) and `integrator_substeps = 10` plumbed through the
  orchestrator's persistence span. Default-off path stays
  `apply_action` so the replay-fingerprint contract from ADR 0004
  / Phase 9.2 is unaffected. ADR 0007 updated with a
  "Status update — Phase 2.1" section. 4 integration tests pin
  the flag-on attitude lag and the substep granularity.

### Phase 3 — Safe-mode recovery hysteresis

- **3.1** **ADR 0011** — *Safe-mode recovery hysteresis.* Frames the
  asymmetric escalate-fast / cooled-recovery policy. Adds **I11**
  to `docs/INVARIANTS.md` and a boundary comment on
  `docs/formal/SafeMode.tla` documenting that hysteresis is
  enforced *outside* `EvaluateMode` and tested separately.
- **3.2** Implementation. `SafeModeManager.evaluate` is now a
  hysteresis wrapper around the pure `_evaluate_proposed` (the
  function the TLA+ spec models). De-escalations require
  `safe_mode_recovery_steps` consecutive proposals;
  `safe_mode_recovery_steps` is finally **read by code**.
  `tests/properties/test_invariant_11_hysteresis.py` enforces I11
  across 30 random fault schedules.

### Phase 4 — Persistence

- **4.1** `SENTINEL_DB_PATH` env override. Default `:memory:` so
  unit tests stay hermetic; filesystem path triggers
  `PRAGMA journal_mode=WAL` and `PRAGMA synchronous=NORMAL` on
  first connect. Database singleton is now lazily initialised so a
  test that monkeypatches the env var picks up the override on the
  next `reset_state_for_tests()`.
- **4.2** Compose volume + DEPLOYMENT.md. Backend service mounts
  named volume `sentinel-data` at `/data` and sets
  `SENTINEL_DB_PATH=/data/driftguard.db`. Container stays
  `read_only: true`. New deployment subsection covers the WAL
  guarantee, multi-replica non-guarantee, backup/restore tar
  recipe, and a smoke-test recipe.

### Phase 5 — Security & reliability polish

- **5.1** Bearer-token compare uses `hmac.compare_digest`
  (constant-time). `x-forwarded-for` is **ignored by default**;
  honoured only when the immediate peer is in the new
  `SENTINEL_TRUSTED_PROXIES` CIDR list.
- **5.2** Latency thresholds in `FaultDetector` decoupled from
  invalid-output thresholds. New
  `latency_warning_threshold` / `latency_critical_threshold`
  config fields default to the invalid_* values, so existing
  behaviour is preserved.
- **5.3** `TrustDetector.unhealthy_controllers/critical_controllers`
  renamed to `unhealthy_components/critical_components` with
  docstrings calling out that they are not the same as the
  like-named `FaultDetector` methods. Recovery-gate
  `and ... or ... and` clause parenthesised explicitly (no
  semantic change; pinned by a new test).

### Phase 6 — Frontend hardening

- **6.1** ESLint 9 flat config (`eslint.config.mjs`) + Prettier
  config + scripts (`lint`, `lint:fix`, `format`, `format:check`).
  `@typescript-eslint/no-explicit-any: error` with `fixToUnknown`;
  bulk `--fix` ran across the codebase, every typecheck regression
  was paid off with proper types in `types/api.ts`. CI runs lint +
  format-check.
- **6.2a** Vitest unit-test setup with 5 tests on the API client
  error contract (2xx, 4xx with `error` envelope, FastAPI 422
  detail, fallback message, network failure).
- **6.2b** Playwright smoke test (`@playwright/test`) — landing
  renders, dashboard renders without runtime errors. Separate
  `e2e` job in `frontend.yml`, 5-minute timeout.
- **6.3** Server-side auth proxy at `app/api/proxy/[...path]`.
  Mutating calls go through it; `SENTINEL_API_TOKEN` is read
  server-side and never exposed to the browser. 3 routing tests
  pin `write → /api/proxy`, `read → API_BASE`, `YAML upload →
  /api/proxy`. `docker-compose.yml` wires `SENTINEL_BACKEND_URL`
  for the in-cluster path.

### Phase 7 — Observability polish

- **7.1** `/healthz` (always 200, liveness) and `/readyz` (200/503,
  readiness) split out as Kubernetes-style probes. Operator-
  friendly `/health` and `/ready` aliases preserved.
  `docker-compose.yml` and the Dockerfile healthcheck switched
  from `/health` to `/readyz`. `docs/OBSERVABILITY.md` gains a
  "Known limits" section enumerating the in-process registry,
  in-process rate limiter, and Prometheus simulation_id
  cardinality boundaries.

### Phase 9 — Release & supply-chain hardening

- **9.1** Backend `Dockerfile` is now multi-stage with a pinned
  `python:3.11.9-slim-bookworm` base, BuildKit pip cache mount,
  non-root runtime user, and a `HEALTHCHECK` against `/health`.
- **9.2** Frontend `Dockerfile` ships the Next.js standalone
  bundle on `node:20.18-alpine` (no `node_modules` in the runtime
  layer) under a non-root user, with a `HEALTHCHECK` against `/`.
- **9.3** New `supply-chain` GitHub workflow runs Anchore syft to
  emit per-target CycloneDX SBOMs as workflow artifacts (30 day
  retention), on every push, every PR, and weekly cron.
- **9.4** Same workflow runs Aqua Trivy in `fs` mode against
  backend and frontend, failing on `HIGH`/`CRITICAL` (with
  `ignore-unfixed` so we do not block on unpatchable advisories).
- **9.5** `docker-compose.yml` adds healthchecks, `restart:
  unless-stopped`, `read_only` root filesystem with `/tmp` tmpfs,
  `no-new-privileges`, and `cap_drop: ALL` for both services.

## [0.2.0] — 2026-05-05

### Phase 8 — Hardening: security, errors, resource limits

- **8.1** YAML scenario loader caps payloads to 64 KiB and nesting
  to depth 12 — hostile uploads now reject before reaching
  `yaml.safe_load`.
- **8.2** In-process sliding-window rate limiter (60 writes/min,
  600 reads/min, `/metrics` exempt). Read and write buckets are
  tracked under separate keys; breach returns
  `429 {"error":{"code":"rate_limited"}}` with `retry-after: 60`.
- **8.3** Optional bearer-token guard on every state-mutating route,
  enabled by setting `SENTINEL_API_TOKEN`. Read endpoints are never
  gated.
- **8.4** Per-simulation step cap (`MAX_STEPS = 10_000`), per-sim
  fault cap (`MAX_FAULTS = 100`), and an LRU-evicting in-memory
  registry (`MAX_REGISTRY_SIZE = 100`). Eviction does not delete
  persisted simulations — they remain queryable through the read
  endpoints.
- **8.5** `SENTINEL_CORS_ORIGINS` now drives the CORS allowlist;
  the literal `"*"` is permitted but explicitly opt-in.
- **8.6** Error taxonomy now spans `validation`, `not_found`,
  `conflict`, `capacity_exceeded`, `unauthorized`, and
  `rate_limited` — every API error response carries
  `{"error":{"code":..., "message":...}}`. Stable `code` is the
  frontend switch surface.
- **8.7** `bandit -q -r app -c pyproject.toml` and `pip-audit -r
  requirements.txt -r requirements-dev.txt` are mandatory CI
  gates. `B311` is skipped with documented rationale (deterministic
  Mersenne-Twister RNG is load-bearing per ADR 0006).

### Phase 7 — Frontend application

- Next.js 14 App Router + TypeScript + Tailwind, wired to the
  backend through a typed API client and SWR hooks.
- Pages: dashboard, scenarios (list + authoring), simulation
  detail (with telemetry charts and trajectory map), live SSE
  view, replay, and mission report.
- Reusable UI primitives, mission-report charts, print CSS, and
  reduced-motion + accessibility polish.

### Phase 6 — Anomaly sidecar

- From-scratch isolation-forest detector wired into the step loop.
- ADR 0009 fixes its role as **advisory only**; an AST-walking
  firewall test guarantees its outputs cannot influence the
  control path.
- Mission report surfaces ML-vs-deterministic agreement.

### Phase 5 — Scenario authoring

- YAML loader with pydantic validation, full schema docs, and a
  fault DSL with linear-ramp metadata.
- `POST /scenarios`, `DELETE /scenarios/{name}` (with built-in
  immutability), and parameter overrides on
  `POST /scenarios/{name}/run`.
- Frontend scenario authoring page with a YAML editor.

### Phase 4 — Observability

- structlog setup with env-driven JSON/console format and a
  per-event log line.
- Prometheus metrics on every step + `/metrics` exposition.
- OpenTelemetry tracing with optional console exporter; the step
  loop emits a span tree per simulation step.
- `docs/SIGNAL_MAP.md` documents the event ↔ metric ↔ trace map.

### Phase 3 — Health detection

- Sliding-window disagreement tracking, per-controller trust
  scores, per-sensor confidence, recovery cooldowns, and
  escalation/de-escalation thresholds.
- Component health states: `HEALTHY`, `SUSPECT`, `DEGRADED`,
  `CRITICAL`, `RECOVERING`.

### Phase 2 — Persistence + recovery

- Repository methods for simulations, steps, faults, decisions,
  sensor readings, controller outputs, votes, and events.
- `GET /simulations`, `/simulations/{id}`, `/decisions`,
  `/faults`, `/timeline` reconstruct the full state from SQLite.

### Phase 1 — Backend architecture

- Centralized ID generation (`core/ids.py`), deterministic clock
  (`core/time.py`), typed application exceptions
  (`core/exceptions.py`), and consistent API error responses.

### Phase 0 — Foundation

- `docs/BUILD_NOTES.md` records the pre-existing baseline this
  expansion built on.
