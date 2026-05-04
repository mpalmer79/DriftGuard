# SentinelNav Backend

FastAPI + Python implementation of the deterministic, fault-tolerant
control-system simulation described in [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

## Layout

```
app/
  api/             # FastAPI routers + dependencies + error handling
  core/            # ids, time, exceptions, config
  domain/          # enums, dataclasses (models, events)
  simulation/      # vehicle, sensors, controllers, voting,
                   # faults, counter-based + trust detection,
                   # safe mode, event logger, orchestrator
  scenarios/       # scenario registry and execution
  reporting/       # mission report (JSON + Markdown)
  persistence/     # SQLite schema and repository
  tests/           # pytest test suite
```

## Run

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API: `http://localhost:8000` — interactive docs at `/docs`.

## Tests

```bash
pytest -q
```

Covers:

- voting (majority, split, insufficient, latency exclusion)
- controller behavior and determinism
- counter-based fault detection
- trust detector (escalation, recovery, repeat memory)
- safe-mode triggers and action restriction
- simulation flow + determinism + per-step events
- 14 fault types, including intermittent patterns and forced actions
- persistence repository read methods + timeline reconstruction
- scenario registry, scenario determinism, expected mode behavior
- mission report (sections, markdown, endpoints)
- API contracts for original and recovery endpoints

## Notes

- The default SQLite database is in-memory and resets between
  processes. Point `Database(path=...)` at a file path to persist.
- The orchestrator runs the full control loop and exposes a typed
  `StepRecord` per tick.
