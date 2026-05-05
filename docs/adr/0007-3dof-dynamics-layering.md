# ADR 0007: 3-DOF dynamics layered under the legacy kinematic update

- **Status**: Accepted
- **Date**: 2026-05-04
- **Phase**: Phase 2.1 / 2.2

## Context

Phase 2's directive is to replace the discrete-step kinematic vehicle
model with a continuous-time integrator and add 3-DOF dynamics. At
the same time, the project's compatibility rules require that the 98
baseline tests at the start of Phase 2 keep passing — many of those
tests assert specific scenarios produce specific mode trajectories,
which depend on the per-step deltas the legacy `apply_action`
produces.

A full replacement of `apply_action` would change those deltas and
shift seed-dependent test behavior even for nominally-passing
scenarios. The directive forbids that without a deliberate justified
test update.

## Decision

Layer the new dynamics under the existing API rather than replace it.

- Pure dynamics primitives in `backend/app/simulation/dynamics/`
  (altitude, velocity, heading, pitch, roll, displacement) — each
  small, pure, and unit-tested.
- A continuous-time integrator in
  `backend/app/simulation/dynamics/integrator.py` that consumes
  `Action` enums by translating them into commanded states and
  driving the primitives across N substeps with first-order attitude
  lag.
- The legacy `apply_action` in `simulation/vehicle.py` stays. The
  Phase 2 sensors / EKF / mission tests use the integrator directly;
  the existing scenarios continue to use `apply_action`.

The orchestrator gains no flag yet — the integrator is reachable
through direct construction. A follow-up phase that introduces
mission mode or realistic-mode controllers will add a config switch
to route the orchestrator through the integrator. That work is
deferred to keep this PR atomic.

## Consequences

### Positive

- Zero regression: every baseline test passes unchanged.
- The new dynamics are independently testable. The Phase 2.1 and 2.2
  tests cover them; the existing scenario tests cover the legacy
  path.
- Phase 2.5 EKF tests can integrate against the new integrator
  directly without depending on the orchestrator's wiring.

### Negative / Tradeoffs

- Two paths exist for "advance the vehicle one step." Readers must
  know which one a given scenario uses.
- Some duplication between `apply_action` and `integrate_action`
  (action-to-effect mapping). The duplication is small enough that
  consolidating now would not pay; it will when the orchestrator
  config switch lands.

### Neutral

- The `VehicleState` dataclass is unchanged. Both paths produce the
  same field set; downstream consumers (events, persistence, report)
  do not care which produced it.

## Alternatives Considered

### Replace `apply_action` outright

Cleaner architecturally but would shift seed-dependent test
behavior. The directive explicitly forbids that without justified
test updates and the test count was not the right signal to chase
right now — Phase 2 should land the new sensors and the EKF, not a
rewrite of every scenario's expected mode trajectory.

### Hide the integrator behind `apply_action`'s signature

Would let scenarios opt in transparently. Rejected because the
integrator advances `step` and `timestamp` differently and accepts
`dt_total` / `substeps` arguments that `apply_action` does not. The
explicit two-path layout is more honest about what is actually
happening.

## References

- Code: `backend/app/simulation/vehicle.py` (legacy), `backend/app/simulation/dynamics/` (new).
- Tests: `backend/app/tests/test_dynamics_*.py`, `backend/app/tests/test_simulation.py` (legacy path still green).
- Related: ADR 0004 (determinism), ADR 0006 (RNG service — both paths consume the same RNG).
- Successor: an ADR for the orchestrator's "realistic mode" config switch when that lands.
