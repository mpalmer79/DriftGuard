# Changelog

All notable changes are recorded here. Dates are the merge date of the
phase PR into `main`. Sub-phases are atomic conventional commits; this
changelog rolls them up by phase.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/)
and [Semantic Versioning](https://semver.org/) — the project pre-1.0,
so minor bumps absorb feature work and breaking changes are called out
in the relevant phase notes.

## [Unreleased]

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
