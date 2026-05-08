# Determinism Audit

This page is the auditable claim that DriftGuard's simulation core is
deterministic: same seed plus same scenario plus same step count
produces the same `SystemDecision` sequence and the same canonical
event timeline, byte-for-byte, across processes.

## What "deterministic" means here

Per RESEARCH.md §11 and ADR 0006, two replays of the same scenario
must produce:

- the same final mode and the same per-step decisions,
- the same canonical event ordering,
- the same SHA-256 replay fingerprint,
- across two in-process runs **and** across two separate Python
  interpreters.

These are enforced by the test suite:

- `app/tests/test_determinism.py::test_scenario_replay_byte_equality`
  for every built-in scenario,
- `test_ten_replays_are_identical` for the explicit "10 of 10" claim,
- `test_property_same_seed_same_history` for hypothesis coverage,
- `test_cross_process_equivalence` for cross-process equivalence.

## Sources of randomness

The only randomness consumers on the simulation path are:

| Consumer | Child name |
| --- | --- |
| Sensor model (Gaussian noise, dropout draws) | `sensor` |
| Controller A fault activation | `controller_a.fault` |
| Controller B fault activation | `controller_b.fault` |
| Controller C fault activation | `controller_c.fault` |

Every one of them is sourced from `core.rng.RngService.child(...)`,
seeded by SHA-256 of `f"{root_seed}:{name}"`. The derivation is
independent of `PYTHONHASHSEED`. See ADR 0006.

## Wall-clock policy

The simulation step loop never reads a wall clock. The only
`time.time()` call in `backend/app/` is inside
`core.time.SystemClock.now()`, which is the production implementation
of the `Clock` protocol used by `persistence.SimulationRepository` to
stamp `simulations.created_at`. Tests inject `core.time.FrozenClock`
so persisted timestamps are reproducible.

Audited on: 2026-05-04. Re-running:

    grep -rn 'time\.time\|datetime\.now\|datetime\.utcnow' backend/app --include='*.py'

should return only `core/time.py` matches.

## What is **not** deterministic

These fields are intentionally non-deterministic and are scrubbed
from the canonical timeline before fingerprinting:

- `event_id` — UUID, exists to disambiguate persisted rows.
- `reading_id` — UUID, same purpose.
- `simulation_id` — UUID, identifies the run, not the timeline content.
- `simulations.created_at` — reflects when the row was persisted, not
  when the simulated event occurred. (Use `FrozenClock` to make it
  reproducible in tests.)

If you add a new non-deterministic field to a persisted row, add it to
`_NONDETERMINISTIC_FIELDS` in `core/canonical.py` and document the
reason here. Never silently scrub a field — the canonical fingerprint
is supposed to flag drift.

## Replay fingerprint endpoint

`GET /simulations/{id}/replay-fingerprint` returns:

    {
      "simulation_id": "...",
      "step_count": 8,
      "fingerprint": "<64 hex chars>",
      "algorithm": "sha256"
    }

The fingerprint is computed from the persisted timeline (state, sensor,
controllers, vote, decision, events per step). Two simulations of the
same scenario seed return the same fingerprint; different scenarios or
different seeds diverge.
