# ADR 0004: Determinism enforced through seed propagation

- **Status**: Accepted
- **Date**: 2026-05-04
- **Phase**: Backfill (Phase 0.4)

## Context

Determinism is the central design constraint. "Same seed plus same
fault schedule produces the same decisions and events" is the property
that makes scenarios reproducible, makes the mission report trustworthy
as a post-mortem, and makes property-based testing feasible.

Multiple subsystems consume randomness: the sensor noise model, the
sensor's per-fault dropout decisions, and per-controller fault
activation decisions for intermittent / probabilistic faults.

## Decision

Every random source is seeded from the simulation's root seed:

- The sensor model uses a `random.Random` seeded directly with the root.
- Each controller has its own `random.Random` seeded with a stable
  hash derived from its id (so `controller_a` always uses the same RNG
  regardless of which simulations have run before).
- All ID generation uses `core.ids` and is independent of randomness
  to keep the persistence story stable.

There is no use of bare `random.<func>` or `secrets.<func>` anywhere on
the simulation path.

## Consequences

### Positive

- Two simulations with the same seed produce the same step history
  byte-for-byte, modulo non-deterministic identifiers (event_id,
  reading_id) which are documented as such.
- Property-based tests (Phase 3) can rely on this and assert per-step
  invariants across thousands of seeds.
- The determinism is testable: `test_determinism_same_seed` runs two
  simulations and compares final actions.

### Negative / Tradeoffs

- Cross-contamination risk: if call order between subsystems changes,
  RNG sequences shift. Phase 1.1 will replace the ad-hoc per-subsystem
  RNGs with a centralized seeded RNG service that yields named child
  RNGs to remove this risk.
- We pay for determinism with discipline; nothing prevents a
  contributor from importing `random` directly.

### Neutral

- Identifiers (UUID-based) are explicitly *not* deterministic. They
  exist to disambiguate persisted rows, not to participate in the
  reproducibility claim.

## Alternatives Considered

### Single shared RNG
Simplest, but call-order-fragile: any reordering of sensor reads vs
controller evaluations changes outputs. Rejected.

### Pure-functional RNG (e.g. JAX-style PRNG keys)
Strongest guarantee but heavyweight in a Python-stdlib codebase.
Deferred.

## References

- Code: `backend/app/simulation/sensors.py`,
  `backend/app/simulation/controllers.py`
- Tests: `backend/app/tests/test_simulation.py::test_determinism_same_seed`
- Successor: ADR 0001 will be referenced when Phase 1.1 supersedes the
  ad-hoc RNG layout with a centralized service.
