# DriftGuard Live Demo Script

A reviewer should be able to walk through DriftGuard live and see the key
behaviors (deterministic simulation, redundant voting, fault detection,
mode escalation, replay fingerprints, mission report) in under 5 minutes.
This script is tied to actual routes in `frontend/app/` and the built-in
scenarios in `backend/app/scenarios/builtins.py`.

All routes below have been verified to resolve to real files in the
frontend tree.

---

## Prerequisites

- A running DriftGuard deployment (Railway or local).
- The bearer token, if `SENTINEL_API_TOKEN` is configured. The frontend
  proxy injects it server-side; you should not need it in the browser.
- Optional: a terminal for hitting the JSON endpoints directly to confirm
  fingerprints.

---

## Step 1 — Open the app (`/`)

- Route: `/` -> `frontend/app/page.tsx`.
- Expected observation: landing page with calls-to-action for the
  dashboard and the scenario library.
- Evidence: page loads without an authentication challenge (read paths
  are intentionally open).

## Step 2 — Browse the scenario library (`/scenarios`)

- Route: `/scenarios` -> `frontend/app/scenarios/page.tsx`.
- Click "Browse Scenarios" from the landing page.
- Expected observation: the 10 built-in scenarios from
  `backend/app/scenarios/builtins.py` are listed:
  - `nominal_cruise`
  - `single_controller_latency`
  - `sensor_drift_recovery`
  - `split_vote_escalation`
  - `multi_fault_failure`
  - `intermittent_fault`
  - `sensor_spike_transient`
  - `gps_denied_navigation`
  - `byzantine_low_confidence`
  - `compound_cascading_recovery`
- Evidence: scenario cards render with the description and expected
  behavior pulled from the backend; the page is server-rendered against
  `GET /scenarios`.

## Step 3 — Run the sensor drift scenario

- From `/scenarios`, run `sensor_drift_recovery`.
- Expected behavior, quoted verbatim from `builtins.py`: "Sensor health
  degrades, system restricts unsafe actions, then recovers."
- Qualitative observation: the system briefly enters DEGRADED while the
  sensor altitude bias is active (steps 3-10) and then returns toward
  NORMAL once the fault clears. The exact step counts are deterministic
  because the scenario is seeded (`seed=23`, `steps=25`).
- Evidence to point at: the run card surfaces the trigger reason and
  active fault. The mode band changes color when the safe-mode manager
  promotes the system out of NORMAL.

## Step 4 — Inspect the run detail (`/simulations/{id}`)

- Route: `/simulations/[id]` -> `frontend/app/simulations/[id]/page.tsx`.
- Expected observation: this page is the operator console for a single
  run. It shows:
  - Mode band (NORMAL / DEGRADED / SAFE_MODE / FAILED) over time.
  - Decisions table with the per-step justification string emitted by
    `simulation/orchestrator_decision.py`.
  - Fault timeline derived from `EventLogger`.
  - Vote split per step from `simulation/voting.py`.
- Evidence: the decisions table justification column should show
  detector findings and the safe-mode manager's reason for the
  transition. Trust scores degrade in lockstep with the active fault.

## Step 5 — Run a SAFE_MODE / FAILED escalation

- Run `multi_fault_failure` from `/scenarios`.
- Expected behavior, quoted from `builtins.py`: "System escalates through
  DEGRADED and SAFE_MODE into FAILED." The scenario combines sensor
  dropout, an invalid controller_a, and a silent controller_b.
- Optional: also run `split_vote_escalation` for an explicit
  "no-consensus -> SAFE_MODE" path. Its expected behavior is "Vote
  splits frequently and the system enters SAFE_MODE."
- Evidence to point at on `/simulations/{id}`:
  - Mode band reaches SAFE_MODE (and FAILED in the multi-fault case).
  - Decisions table justification cites both the fault detector and the
    voter's lack of agreement.
  - Vote split column shows the lack of majority.

## Step 6 — Replay and fingerprint (`/simulations/{id}/replay`)

- Route: `/simulations/[id]/replay` ->
  `frontend/app/simulations/[id]/replay/page.tsx`.
- Expected observation: a step-by-step replay of the recorded run pulled
  from `SimulationRepository`. The replay is deterministic because the
  state was persisted, not regenerated.
- Replay fingerprint: from a terminal or the proxy-backed UI, hit
  `GET /simulations/{sim_id}/replay-fingerprint`
  (`backend/app/api/recovery_routes.py` line 70). The response is a
  canonical SHA-256 hash computed by `core/canonical.py`.
- Evidence to highlight: re-running the same scenario with the same seed
  and step count produces the same fingerprint. Different seeds, faults,
  or step counts produce a different hash.

## Step 7 — Mission report (`/simulations/{id}/report`)

- Route: `/simulations/[id]/report` ->
  `frontend/app/simulations/[id]/report/page.tsx`.
- Backend endpoints:
  - `GET /simulations/{sim_id}/report/json` (full structured payload).
  - `GET /simulations/{sim_id}/report/markdown` (human-readable).
- Expected observation: a mission report rendered from
  `backend/app/reporting/mission_report.py`, including the risk
  assessment and the chain of mode transitions.
- Evidence: the report references the same decisions and faults visible
  in step 4, providing an auditable narrative for the run.

## Step 8 — Live SSE stream (`/simulations/{id}/live`)

- Route: `/simulations/[id]/live` ->
  `frontend/app/simulations/[id]/live/page.tsx`. The page opens an
  `EventSource` against `GET /simulations/{sim_id}/stream`
  (`backend/app/api/stream_routes.py`).
- Expected observation: stream a fresh run live; per-step events render
  in real time as the orchestrator steps the simulation.
- Evidence: the connection stays open for the duration of the run; the
  page surfaces an interruption banner if the SSE connection drops
  (which can happen if the simulation is no longer in memory on this
  replica — see the troubleshooting notes below).

---

## Troubleshooting on Railway / live deployment

- **Cold start delay.** The first request after an idle period can take
  10-30 seconds while the container spins up. Refreshing once is fine;
  retry storms are not necessary.
- **Liveness probe.** `GET /healthz` should return 200 as soon as the
  process is up. If it does not, the process did not boot.
- **Readiness probe.** `GET /readyz` should return 200 once SQLite is
  writable and the scenario registry has been populated. A 503 from
  `/readyz` means SQLite is not yet ready for writes or the built-in
  scenarios have not been registered yet (expected for the first second
  or two after a cold start).
- **Single-replica caveat.** The `SimulationRegistry` and the in-memory
  rate limiter are per-process. If the platform spins up a second
  replica, that replica will not see simulations created on the first
  replica, and per-IP rate counters reset. DriftGuard is intentionally
  deployed as a single replica; see `docs/DEPLOYMENT.md` for the
  rationale.
- **Bearer-token writes.** If `SENTINEL_API_TOKEN` is configured, all
  state-mutating endpoints (POST/DELETE) require the token. The Next.js
  proxy at `frontend/app/api/proxy/[...path]/route.ts` injects it
  server-side so the browser never sees it. Read endpoints stay open by
  design.
- **Metrics scrape.** `GET /metrics` is exempt from the rate limiter so
  Prometheus scrapers do not get throttled.

---

## Gaps / TODO

The following minor gaps should be closed in a future pass; they do not
block the demo:

- TODO: The dashboard page `/dashboard` exists, but the demo flow above
  starts at `/scenarios` because that is the most direct path to a run.
  A future revision could anchor the demo from `/dashboard` once it
  surfaces the most recent runs prominently.
- TODO: There is no in-app "click to copy fingerprint" affordance yet on
  `/simulations/[id]/replay`; reviewers currently confirm fingerprint
  determinism by hitting `/simulations/{id}/replay-fingerprint` from a
  terminal or the network tab. Adding a small UI button would tighten
  the loop.
- TODO: The advisory events from `simulation/anomaly_sidecar.py` are
  visible in the events stream, but the run detail page does not yet
  visually distinguish "advisory" events from gating events. Until that
  is added, reviewers should rely on the `metadata.advisory: true` flag
  in the JSON payload to tell them apart.
