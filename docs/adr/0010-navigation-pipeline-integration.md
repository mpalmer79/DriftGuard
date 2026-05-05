# ADR 0010: Wire INS / GPS / EKF into the orchestrator step loop

- **Status**: Accepted
- **Date**: 2026-05-05
- **Phase**: 1 (Navigation pipeline on the live path)

## Context

Three sensor-fusion modules — `simulation/ins.py` (inertial dead reckoning),
`simulation/gps.py` (windowed dropout / spike model), and
`simulation/filtering/ekf.py` (three independent linear KFs over altitude,
velocity, and heading) — were authored during Phase 5 with dedicated unit
tests, but were never imported on the orchestrator's data path. The
controller-facing sensor feed was the single-step `SensorModel` adding
Gaussian noise directly to the truth state.

This created two problems:

1. **A claim-versus-code gap.** The README and portfolio case study
   described a real navigation pipeline. A reviewer who grepped for
   `EKF` in the orchestrator found nothing.
2. **No lever for GPS-denial scenarios.** GPS dropout is a real signal
   the system should respond to (variance growth in the EKF, mode
   degradation downstream). Without the wiring, the dropout had no
   surface to act on.

This ADR captures the decision to make the pipeline the default
controller-facing feed, and the migration policy that protects the
existing 538-test baseline and the deterministic-replay contract from
ADR 0004.

## Decision

The orchestrator runs `INS → GPS → EKF` per step and uses the EKF
estimate (altitude, velocity, heading, pitch, roll, plus EKF variances
and confidence) as the `sensor` argument fed to the controllers,
voting, detection, trust detector, and persistence.

The pipeline is owned by a new `simulation/navigation.py` module
exposing a `NavigationPipeline` class. The class is constructed
unconditionally inside `Simulation.__init__` so the run-time graph is
identical regardless of the flag, but the orchestrator only consults
the pipeline output when `SimulationConfig.navigation_pipeline_enabled`
is `True`.

### Fault application policy

Sensor-target faults are applied to the **inputs** of the navigation
pipeline (the synthesized truth-derived measurements that feed INS and
GPS), not to the EKF output. This preserves two properties:

- The existing fault-injection tests continue to mean what they meant.
  A `SensorDropout` fault still removes a measurement; a `SensorSpike`
  fault still injects a perturbation at the source.
- The EKF performs its job: a spike on a single measurement is
  attenuated by the filter before it reaches the controllers, which
  is the realistic behavior we want a downstream reviewer to see in
  the mission report.

### Migration policy

- **Phase 1.2:** `NavigationPipeline` lands behind a config flag,
  default `False`. Zero existing tests change. Suite stays at 538 pass.
- **Phase 1.3:** Default flips to `True`. Two existing orchestrator
  tests are loosened with explicit `# Phase 1.3` comments to
  accommodate EKF smoothing (the controllers see slightly different
  numbers; tolerances widen, semantics don't). Three new integration
  tests pin the new pipeline-specific properties: GPS-denial
  recovery, multi-step spike attenuation, and the structural sanity
  check that every persisted `StepRecord.sensor` now originates from
  the pipeline.
- **Phase 1.4:** README and portfolio case study claims are
  re-strengthened to describe the pipeline as the default path.

The legacy direct-`SensorModel` mode remains supported (set
`navigation_pipeline_enabled = False`) because the unit-test suite
that exercises `SensorModel` directly is still valuable as a
component-level pin. It is not removed.

### Replay-fingerprint reset

Flipping the default in Phase 1.3 changes the bytes the controllers
see at every step. The canonical replay fingerprint of every default-
config scenario therefore changes. ADR 0004 (Determinism via seeds)
treats fingerprint stability as a contract; this ADR is the
**explicit authorization** to reset that contract once, at the
0.2.0 → 0.3.0 boundary. Phase 9.2 (committed fingerprint regression
files) re-establishes the contract on the new baseline. No further
reset is anticipated; future fingerprint changes require a new ADR.

## Consequences

### Positive

- The README's "INS / GPS / EKF filtering pipeline with GPS-denied
  handling" claim now describes what runs.
- GPS-denial scenarios become first-class: the EKF variance band is
  visible in the mission report and the trust panel reacts to the
  resulting confidence drop.
- Sensor spike faults are filtered before reaching controllers,
  which is the realistic and demonstrable behavior.
- The `NavigationPipeline` is a clean extension point. A future
  attitude EKF or wheel-odometry fusion drops in without further
  orchestrator changes.

### Negative / Tradeoffs

- One-time replay-fingerprint reset (handled by Phase 9.2).
- The orchestrator gains a branch (`if navigation_pipeline_enabled`).
  The branch is straight-line and well-commented; the cost is small.
- Two existing tests were loosened. Both have explicit
  `# Phase 1.3` comments explaining why.

### Neutral

- The legacy `SensorModel` is still constructed for the moments where
  faults need to be applied to its raw output before the pipeline
  consumes it. The two are not mutually exclusive at the object
  graph level — only at the data-flow level.

## Alternatives Considered

### Replace `SensorModel` outright

Cleaner end-state, but would have required rewriting every test that
pins `SensorModel` behavior in the same change set. The flag-gated
migration lets the unit-level pin survive as a component test while
the orchestrator-level path moves on.

### Apply faults *after* the EKF

Tempting because it would let existing fault-injection tests pass
with their original tolerances. Rejected because it makes the EKF a
no-op for fault scenarios — exactly the case where the filter has
the most value. Filtering a spike that was injected after the filter
is meaningless.

### Keep the pipeline as opt-in indefinitely

Rejected because it perpetuates the claim-versus-code gap. The whole
point of Phase 1 is to make the pipeline real, and "real" means "on
by default."

## References

- Code: `backend/app/simulation/navigation.py`,
  `backend/app/simulation/orchestrator.py`,
  `backend/app/simulation/filtering/ekf.py`,
  `backend/app/simulation/ins.py`,
  `backend/app/simulation/gps.py`
- Tests: `backend/app/tests/test_navigation_pipeline.py`
- Related ADRs: ADR 0004 (Determinism via seeds — the contract this
  ADR resets once), ADR 0007 (3DoF dynamics layering — same
  flag-gated migration shape), ADR 0009 (Anomaly detector advisory-
  only — same "do not let it gate safe-mode" discipline)
