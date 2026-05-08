# DriftGuard API

All endpoints return JSON unless otherwise noted. Errors use a unified shape:

```json
{ "error": { "code": "not_found", "message": "simulation 'X' not found" } }
```

## Health

`GET /health` → `{"status":"ok"}`

## Simulations

| Method | Path                                    | Description                              |
| ------ | --------------------------------------- | ---------------------------------------- |
| POST   | `/simulations`                          | Create a simulation; body `{seed?, simulation_id?}` |
| POST   | `/simulations/{id}/step`                | Advance the simulation by one step       |
| POST   | `/simulations/{id}/faults`              | Inject a fault                           |
| GET    | `/simulations`                          | List persisted simulations               |
| GET    | `/simulations/{id}`                     | Simulation summary + latest persisted state |
| GET    | `/simulations/{id}/state`               | Current in-memory vehicle state          |
| GET    | `/simulations/{id}/events`              | All events emitted by the simulation     |
| GET    | `/simulations/{id}/decisions`           | Persisted decisions                       |
| GET    | `/simulations/{id}/faults`              | Persisted fault records                   |
| GET    | `/simulations/{id}/timeline`            | Combined per-step timeline               |
| GET    | `/simulations/{id}/report`              | Mission report (JSON)                    |
| GET    | `/simulations/{id}/report/json`         | Same payload as `/report`                |
| GET    | `/simulations/{id}/report/markdown`     | Markdown render of the report            |

## Scenarios

| Method | Path                              | Description                         |
| ------ | --------------------------------- | ----------------------------------- |
| GET    | `/scenarios`                      | List built-in scenarios             |
| GET    | `/scenarios/{name}`               | Scenario detail                     |
| POST   | `/scenarios/{name}/run`           | Run with the scenario's default steps |
| POST   | `/scenarios/{name}/run/{steps}`   | Run with a custom number of steps   |

A scenario run creates a new simulation, schedules its faults, executes
all steps, persists the result, and returns a `ScenarioResult` summary
including final mode, decision counts, mode transitions, and a trust
snapshot.

## Decision causality fields

Every persisted decision row and live `/step` response carries a set
of additive operator-causality fields that the dashboard reads
directly. Existing fields (`final_action`, `system_mode`,
`safe_mode_active`, `justification`, `trusted`, `rejected`) are
preserved for backward compatibility.

| Field               | Type                  | Source                                          | Notes                                                    |
| ------------------- | --------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| `previous_mode`     | `SystemMode` string   | `SafeModeManager.current_mode` before evaluate  | `NORMAL` at step 1; otherwise the prior step's mode      |
| `trigger_reason`    | string                | Mirrors `justification`                         | Operator-friendly alias; both fields are returned        |
| `active_fault_ids`  | array of fault IDs    | `FaultRegistry.active_at(step)`                 | UUIDs; intentionally scrubbed from replay fingerprint    |
| `detector_findings` | array of `{component, severity, message}` | `TrustDetector.update(...)` for the step | Empty when no health transition fired this step          |
| `vote_split`        | object                | Compact summary of the per-step `VoteResult`    | `{outcome, selected_action, agreeing, rejected, reason}` |

Endpoints carrying these fields:

- `POST /simulations/{id}/step` — under `decision`.
- `GET /simulations/{id}/decisions` — flattened onto each row (read-side
  back-fills safe defaults for legacy rows persisted before the
  `causality_payload` migration ran).
- `GET /simulations/{id}/timeline` — under each entry's `decision`.

## Fault payload

```json
{
  "type": "CONTROLLER_LATENCY",
  "target": "controller_b",
  "start_step": 4,
  "duration": 6,
  "severity": "WARNING",
  "metadata": {"latency_ms": 250}
}
```

Valid `target` values are `sensor`, `controller_a`, `controller_b`,
`controller_c`. See `docs/FAULT_MODEL.md` for fault-specific metadata.
