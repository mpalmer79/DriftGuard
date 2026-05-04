# SentinelNav Fault Model

Faults are first-class records. They have a target, a start step, an
optional duration, and metadata that controls behavior. The
`FaultRegistry` decides which faults are active on a given step; the
sensor and controllers react to them deterministically.

## Targets

- `sensor`
- `controller_a`, `controller_b`, `controller_c`

## Sensor faults

| Type | Effect | Useful metadata |
| --- | --- | --- |
| `SENSOR_DRIFT` | Adds an accumulating offset to altitude (and optionally other fields) | `magnitude`, `affected_fields` |
| `SENSOR_SPIKE` | One-shot large offset to altitude/velocity | `magnitude` |
| `SENSOR_NOISE_SPIKE` | Increases per-tick Gaussian noise | `magnitude` |
| `SENSOR_DROPOUT` | Per-tick probability of marking the reading INVALID | `probability` |
| `DATA_LOSS` | Hard invalid reading every active step | — |

## Controller faults

| Type | Effect | Useful metadata |
| --- | --- | --- |
| `CONTROLLER_BIAS` | Adds an offset to perceived altitude | `offset` |
| `CONTROLLER_TIMEOUT` | Forces a fixed delay above the latency budget | `delay_ms` |
| `CONTROLLER_LATENCY` | Adds latency without forcing rejection unless above threshold | `latency_ms` |
| `CONTROLLER_INVALID_OUTPUT` | Marks the output as invalid | — |
| `CONTROLLER_CONFIDENCE_DROP` | Multiplies confidence by a factor | `confidence` |
| `CONTROLLER_ACTION_BIAS` | Replaces the chosen action | `forced_action` |
| `CONTROLLER_SILENT_FAILURE` | Returns an invalid HOLD with no signal | — |
| `CONFLICTING_CONTROLLER` | Flips action to its opposite (e.g. ASCEND→DESCEND) | — |
| `COMPOUND_FAULT` | Bias + latency + confidence drop in one fault | `offset`, `latency_ms`, `confidence` |

## Cross-cutting metadata

Available to every fault:

- `intermittent_pattern: [0|1, ...]` — indexed by `(step - start_step) % len`.
  Lets you flicker faults on and off for replay studies.
- `probability: float in [0, 1]` — per-tick activation probability.
- `affected_fields: ["altitude", "velocity", ...]` — restrict which
  sensor fields drift.

## Determinism

- The sensor RNG is seeded by `Simulation.seed`.
- Each controller has its own RNG seeded by a hash of its id, so
  probabilistic faults still replay identically.
- Fault behavior is therefore stable across runs with the same seed.
