# ADR 0010: Wire INS / GPS / EKF into the orchestrator step loop

- **Status**: Proposed
- **Date**: 2026-05-05
- **Phase**: Phase 1 (PRs 1.2–1.4)

## Context

The repo ships three navigation modules — `simulation/ins.py`,
`simulation/gps.py`, and `simulation/filtering/ekf.py` — each with
its own unit-test file (`test_ins.py`, `test_gps.py`, `test_ekf.py`).
The README and the portfolio case study describe an "INS / GPS / EKF
filtering pipeline with GPS-denied handling" as a system feature.

The principal-grade review found that none of these modules are
imported on the orchestrator path:

```
$ grep -rn "EKF\|filtering\|ins\.\|gps\.\|navigation" \
    backend/app/simulation/orchestrator*.py \
    backend/app/simulation/sensors.py
# no matches
```

The live sensor feed is `SensorModel.read()`: take the truth state,
add Gaussian noise, apply sensor-target faults, hand the result to the
controllers. The reference modules exist as side modules with passing
unit tests, not as a live pipeline. PR 0.2 softened the README claim
ahead of this work landing; this ADR is the substantive fix.

The trust detector and the anomaly sidecar both already consume
sensor confidence; once a real EKF runs in the loop, a "GPS-denied
window → INS-only drift visible in EKF variance → recovery on GPS
return" scenario becomes a first-class feature instead of a side
test. That is the highest-leverage missing wiring in the project.

## Decision

The orchestrator gains a `NavigationPipeline` that runs `INS → GPS →
EKF` per step. Its output is a `SensorReading`-shaped dataclass
(altitude, velocity, heading, pitch, roll, confidence, status,
fault_flags, plus position and EKF variances for observability).
That output is what the controllers see — **not** the truth state
plus noise.

Sensor-target faults are applied to the **inputs** of the navigation
pipeline (perturbing the INS / GPS measurements), not to the
filtered output. This preserves the meaning of every existing
sensor-fault test: a sensor drift still drifts the controller's
view of altitude; a GPS dropout still degrades position fix; a
sensor spike still propagates to the controller. The behaviour after
EKF smoothing differs in magnitude — the filter attenuates short
spikes — and the integration tests added in PR 1.3 will pin that
difference rather than hide it.

The wiring lands behind a config flag (`navigation_pipeline_enabled`)
in two stages:

- **PR 1.2** — pipeline module exists alongside the legacy path.
  The flag is `False` by default. No existing test changes. Unit
  tests for the new module land here.
- **PR 1.3** — the flag flips to `True`. Tests that pin
  orchestrator-level numerical tolerances are loosened with explicit
  comments where EKF smoothing legitimately changes the magnitude
  of an observable. Three new integration tests assert
  pipeline-specific properties (GPS-denial recovery, spike
  attenuation, convergence-to-truth). Unit tests of the modules
  themselves (`test_sensor_model.py`, `test_ins.py`, `test_gps.py`,
  `test_ekf.py`) are kept as-is — they test the units, not the
  orchestrator path.

## Consequences

### Positive

- The README's "INS / GPS / EKF filtering pipeline with GPS-denied
  handling" claim becomes accurate by PR 1.4. Reviewers grepping
  for the wiring will find it.
- GPS-denial scenarios become authorable as YAML scenarios. The
  EKF's variance band is a natural signal for the trust detector
  to consume in a future phase.
- The mission report gains a meaningful "EKF variance during fault
  window" metric that today has nothing to compute.
- The trust detector and anomaly sidecar consume a smoothed signal
  with a real noise model. Their existing thresholds were tuned
  against `SensorModel`'s Gaussian noise, so PR 1.3's loosening
  comments document the calibration change explicitly.

### Negative / Tradeoffs

- The replay fingerprint for default-config scenarios will change
  on the PR 1.3 boundary. ADR 0004 / Phase 9.2 (replay-fingerprint
  regression files) treat fingerprint stability as a hard property
  for default-config runs. PR 1.3's deliberate fingerprint reset
  is the only authorised change in this plan and is captured in
  the PR description.
- The legacy `SensorModel` path remains reachable via
  `navigation_pipeline_enabled = False`. That preserves a known-good
  baseline for the unit tests that pin `SensorModel` behaviour
  directly, but it is a second-class path going forward and should
  be removed once the EKF-on-default branch has soaked.
- Sensor faults now surface through the EKF before reaching the
  controller. A "small drift" fault may be filtered down to an
  inconsequential signal at the controller. That is realistic
  behaviour, but it means the calibration of fault magnitudes in
  the existing scenarios may need revisiting in a follow-up phase.

### Neutral

- The pipeline does not introduce any new third-party dependency.
  EKF, INS, and GPS already exist in-tree, written from scratch
  (consistent with ADR 0009's "no scikit-learn" precedent).

## Alternatives Considered

### Replace `SensorModel` outright

Cleanest from a "one path, no flag" standpoint. Rejected because:

1. It would force every sensor-fault test (`test_sensor_model.py`,
   `test_advanced_faults.py`, scenario tests) to be re-tuned in a
   single PR — way over the two-files-per-commit budget.
2. It would orphan the unit tests for the legacy `SensorModel`,
   which still pin behaviour useful for understanding the sensor
   surface in isolation.
3. It would invalidate the determinism story (replay fingerprint)
   in a way that is harder to audit. A staged flag-flip + explicit
   loosening comments is auditable; a single big-bang replacement
   is not.

### Apply faults to the EKF output instead of its inputs

Easier to wire (one site of truth for fault application). Rejected
because it makes faults inject onto a smoothed signal — a `SENSOR_SPIKE`
applied to the EKF output is not what a "spike" *is*. It would also
make the existing fault calibration meaningless.

### Keep the EKF off and document that as the policy

Easiest. Rejected because it forecloses a portfolio differentiator
(GPS-denied scenario authoring) and because the README claim has been
accurate-by-future-tense since the modules were added; this ADR pays
that off.

## References

- Code: `backend/app/simulation/ins.py`,
  `backend/app/simulation/gps.py`,
  `backend/app/simulation/filtering/ekf.py`,
  `backend/app/simulation/sensors.py`,
  `backend/app/simulation/orchestrator.py`
- Tests assumed by this ADR (will be loosened in PR 1.3 with
  explicit comments): `backend/app/tests/test_simulation.py`,
  `backend/app/tests/test_scenarios.py`,
  `backend/app/tests/test_advanced_faults.py`.
  Unit tests on the underlying modules (`test_sensor_model.py`,
  `test_ins.py`, `test_gps.py`, `test_ekf.py`) are kept as-is.
- Related: ADR 0004 (determinism via seeds), ADR 0006 (RNG service),
  ADR 0009 (anomaly advisory firewall), RESEARCH.md §11.
