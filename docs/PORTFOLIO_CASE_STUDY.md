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
- **Sensor model** — Gaussian noise plus fault hooks that can drift,
  spike, dropout, or invalidate.
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
- Recovery requires sustained healthy behavior; one good step is not
  enough to leave a degraded state.

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
- **No auth / open CORS** — this is a portfolio demo, not a
  production-fronted service.
- **Two detectors, not one** — the older counter-based detector still
  drives the safe-mode manager so existing behavior and tests stay
  stable; the new trust detector layers on top with health states.
  A future cleanup would consolidate them.
- **Simple physics** — the goal was control flow, not flight modeling.

## What I would improve next

- Replace the dual detectors with a single windowed model and have the
  safe-mode manager consume health states directly.
- Persist the trust snapshot per step so the report can show health
  over time, not just at the end.
- Add a scenario authoring UI on top of the registry.
- Replay the trust state in the frontend chart, not just the table.
- Switch the SQLite default to a project-local file, so demos retain
  state between restarts.

## Skills demonstrated

- System design with clear separation of concerns and explicit
  contracts.
- Deterministic simulation engineering.
- Test-driven backend development (≈ 65 pytest cases at handoff).
- FastAPI with typed schemas, error handling, and CORS.
- Persistence design: schema, repository, recovery from disk.
- Time-windowed monitoring with escalation/recovery semantics.
- Frontend integration: typed API client, server-readable timeline,
  replay control.
- Documentation as a first-class deliverable.
