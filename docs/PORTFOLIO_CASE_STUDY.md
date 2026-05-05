# SentinelNav — Portfolio Case Study

## Problem

Mission-critical control systems (aerospace, defense, automotive,
medical) cannot afford ambiguous failure. They typically use redundant
controllers with majority voting and explicit safe-mode behavior. The
problem this project tackles: build a small, inspectable simulation of
that pattern that you can poke at, run scenarios against, and audit
after the fact.

## Why this matters

Safety-critical software lives or dies on three properties:

1. **Determinism** — the same inputs must produce the same outputs,
   forever.
2. **Explainability** — when the system makes a decision, you must be
   able to reconstruct *why*.
3. **Bounded failure** — when something goes wrong, the system should
   degrade in known ways, not in arbitrary ones.

Most prototypes get one of these. SentinelNav is built so all three
are visible to the reader.

## System design

- **Backend (Python / FastAPI)** — orchestrator, three controllers,
  voting, two layers of fault detection, safe-mode manager, scenario
  engine, mission report generator, SQLite persistence.
- **Frontend (Next.js + TypeScript + Tailwind)** — landing, dashboard,
  scenarios, simulation detail, replay, mission report. Talks to the
  backend through a single typed API client.
- **Documentation** — architecture, API, scenarios, fault model,
  deployment.

The simulation loop is intentionally short and unambiguous: load
state, read sensors, dispatch to controllers, vote, detect, transition
mode, decide action, advance state, log.

## Simulation architecture

- **Vehicle state engine** — pure-function transformation per action
  with bounds; no hidden global state.
- **Sensor model** — the controller-facing reading is the output of
  an INS + GPS + EKF fusion stack. The INS integrates a noisy
  version of truth state every step; GPS samples truth at a slower
  cadence with its own noise; the EKF predicts from the INS and
  updates from GPS when available. Sensor-target faults inject onto
  the INS measurement (so a `SENSOR_DRIFT` still drifts what the INS
  observes); a `GPS_DENIED` fault on the GPS target makes the EKF
  run INS-only for the duration of the denial, with the variance
  band growing visibly. Phase 1.4 wired this in by default; flip
  `SimulationConfig.navigation_pipeline_enabled = False` to fall
  back to the legacy direct-`SensorModel` feed for the unit-test
  baseline. See ADR 0010.

  *Why GPS-denial earns its place:* it's the simplest demonstration
  in the project that "uncertainty is observable." The EKF altitude
  variance stays bounded under nominal conditions, grows during the
  denial window (no measurement correction), and snaps back inside
  its measurement-noise band once GPS returns — exactly the
  behaviour an aerospace reviewer expects from a fault-tolerant
  navigation stack.
- **Controllers** — three implementations with intentionally different
  decision boundaries so they actually disagree under stress:
  - **A: Conservative** — wide deadbands, slower response.
  - **B: Responsive** — narrow deadbands, fastest response.
  - **C: Balanced** — middle ground with attitude guard.
- **Voting** — majority over valid, on-time outputs.
- **Detection (two layers)**:
  - Counter-based detector keeps the legacy contract for safe-mode
    inputs.
  - Trust detector adds a sliding window, per-component trust score,
    repeat memory, and recovery cooldown.

## Safety model

- Modes follow `NORMAL → DEGRADED → SAFE_MODE → FAILED`.
- Safe mode restricts the action set to `{HOLD, STABILIZE,
  DECELERATE, ABORT}`.
- Failed mode forces `ABORT` as the fallback action.
- Per-component recovery requires sustained healthy behavior — the
  trust detector enforces a multi-step clean streak before a
  component returns to `HEALTHY`.
- **System-mode recovery hysteresis** (ADR 0011 / I11). Escalations
  are immediate so a safety-critical fault can promote the mode in
  a single step. De-escalations require
  `safe_mode_recovery_steps` consecutive proposals of the
  same-or-less-severe mode, so a borderline fault can't flap
  NORMAL → SAFE_MODE → NORMAL on noisy inputs. The pure clause body
  (the function the TLA+ spec models) is split out from the
  hysteresis wrapper, so the spec stays faithful and the property
  test for I11 enforces the wrapper independently.

## Fault handling

Faults are first-class records with metadata. They support:
- Magnitude / bias / forced action.
- Latency.
- Confidence drop.
- Probability and intermittent patterns (per-step on/off mask).
- Affected sensor fields.

This lets you set up things like "controller_b flickers between
healthy and faulty using a 1,1,0,0 pattern for 24 steps" and replay
the run deterministically.

## Tradeoffs

- **In-memory SQLite by default** — the demo resets between processes.
  A volume-mounted DB is one config flip away.
- **Auth + rate-limit are opt-in** — the bearer-token write guard and
  sliding-window limiter exist (Phases 8.2, 8.3) but default off so
  the demo can be poked freely. Production would set
  `SENTINEL_WRITE_TOKEN` and re-enable the limiter.
- **Two detectors, not one** — the older counter-based detector still
  drives the safe-mode manager so existing behaviour and tests stay
  stable; the new trust detector layers on top with health states.
  A future cleanup would consolidate them.
- **Anomaly detector is advisory only** — the isolation-forest
  sidecar (ADR 0009) does not gate the deterministic decision. That
  keeps the safety-critical path explainable but means the ML signal
  surfaces in the report, not the loop.
- **Simple physics** — the goal was control flow, not flight modeling.
  Vehicle dynamics are deliberately first-order (`apply_action`
  applies bounded deltas) so behaviour stays inspectable.
- **Trivy uses `latest` rather than a pinned version.** The supply-
  chain workflow runs weekly, so fresh CVE signatures are the desired
  behaviour; reproducibility for a CVE scanner was always
  "whatever was current at scan time".

## What I would improve next

- Replace the dual detectors with a single windowed model and have the
  safe-mode manager consume health states directly.
- Persist the trust snapshot per step so the report can show health
  over time, not just at the end.
- Add a scenario authoring UI on top of the registry.
- Replay the trust state in the frontend chart, not just the table.
- Switch the SQLite default to a project-local file, so demos retain
  state between restarts.

## Beyond the basics

The first pass of this project shipped the simulation, the API, the
dashboard, and the report. The work since then has been about turning
that prototype into something a senior reviewer can actually inspect:

- **Formal model and property tests.** A TLA+ specification of the
  mode-transition state machine is mirrored by an exhaustive Python
  checker, and the runtime is exercised by `hypothesis`-driven
  invariant tests covering I1–I9 (no escape from `FAILED`, monotone
  controller-trust descent under repeated faults, etc.). 1000-step
  soak runs cross every scenario; a subprocess fuzz harness hunts
  for safe-mode escapes.
- **Replay equivalence as a falsifiable claim.** Every step record
  is canonicalised (UUIDs scrubbed, floats rounded) and hashed into
  a SHA-256 run fingerprint. Two independent runs of the same seed
  must agree byte-for-byte; the property is exposed at
  `/simulations/{id}/replay-fingerprint`.
- **Observability wired through the step loop.** Prometheus metrics,
  OpenTelemetry traces, structured JSON logs, and an SSE stream all
  carry the same `simulation_id` / `step` correlators
  ([`docs/OBSERVABILITY.md`](OBSERVABILITY.md)).
- **Anomaly detector as a non-authoritative sidecar.** An isolation
  forest scores each step's feature vector. Scores are persisted and
  surfaced in the report, but never gate the deterministic decision
  (ADR 0009) — keeping the safety-critical path explainable.
- **Operational hardening.** Optional bearer-token guard on writes,
  sliding-window rate limiter, env-driven CORS allowlist, per-sim
  step + fault caps, LRU eviction on the in-memory registry, YAML
  size + nesting caps.
- **Supply-chain CI.** `ruff`, `bandit`, `pip-audit` run on every
  push; weekly Trivy filesystem scans and CycloneDX SBOMs for both
  the backend and frontend. Hardened multi-stage Dockerfiles and
  compose healthchecks ([`docs/DEPLOYMENT.md`](DEPLOYMENT.md)).

## Skills demonstrated

- System design with clear separation of concerns and explicit
  contracts.
- Deterministic simulation engineering, with a falsifiable replay
  claim backed by canonical-fingerprint hashing.
- Property-based, fuzz, and soak testing in addition to unit tests
  (538 backend tests at handoff, 97% line coverage).
- Formal-spec mirroring: TLA+ → Python checker, with invariants
  pinned from both sides.
- FastAPI with typed schemas, an error taxonomy, CORS allowlist,
  bearer auth, rate limiting, and resource caps.
- Observability discipline: Prometheus metrics, OpenTelemetry traces,
  structured logs, and an SSE stream all sharing correlators.
- Persistence design: schema, repository, recovery from disk.
- Time-windowed monitoring with escalation/recovery semantics and
  per-component health states.
- Supply-chain hygiene: SBOMs, vulnerability scans, Docker hardening.
- Frontend integration: typed API client, server-readable timeline,
  replay control, charts, scenario authoring, print-friendly report.
- Documentation as a first-class deliverable — architecture, API,
  scenarios, fault model, deployment, observability, invariants,
  ADRs.
