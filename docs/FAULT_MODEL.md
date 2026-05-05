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

## Programmable values (DSL, Phase 5.5)

A metadata value can be a plain scalar or a small mapping
describing a time-varying value. Today the only DSL term is the
linear ramp:

```yaml
faults:
  - type: SENSOR_DRIFT
    target: sensor
    start_step: 2
    duration: 20
    metadata:
      magnitude: { ramp: [0, 50, 20] }
```

Reads as: at step `start_step + 0` the value is `0`; at step
`start_step + 20` the value is `50`; in between, linear
interpolation; beyond the ramp, clamped at `50`.

Validation rules:

- `ramp` is a 3-element list `[from, to, steps]`.
- `from` and `to` are numeric.
- `steps` is a positive integer.

Malformed terms are rejected at registration (when the YAML loader
runs or when `register_user_scenario` is called) so they do not
surface as runtime exceptions during a simulation. The DSL is
applied per-step in the sensor model and the controller fault
overlay; if you author a new fault behavior, call
`core.fault_dsl.resolve_metadata(fault.metadata, step_offset)`
where `step_offset = current_step - fault.start_step`.

Adding a new DSL term is intentionally cheap: extend
`core.fault_dsl.is_dsl` / `validate` / `resolve` and document the
shape here. Compose-able terms (e.g. `ramp` + `noise`) belong in a
follow-up ADR before implementation.

## Run-time overrides (Phase 5.4)

`POST /scenarios/{name}/run` and `POST /scenarios/{name}/run/{steps}`
accept an optional JSON body:

```jsonc
{
  "seed": 99,
  "fault_metadata": {
    "0": { "magnitude": 50 }
  }
}
```

The seed replaces the scenario's root seed for this run only.
`fault_metadata` keys are zero-based fault indices in the
scenario's declared order; values are merged over the declared
metadata. Out-of-range indices return 400.

## Determinism

- The sensor RNG and each controller's fault RNG are sourced from
  the central `RngService` (ADR 0006) keyed by simulation seed.
- DSL terms are pure functions of `(step_offset, metadata)`, so
  enabling `ramp` does not break replay determinism.
- Fault behavior is stable across runs with the same seed plus the
  same fault schedule plus the same overrides.
