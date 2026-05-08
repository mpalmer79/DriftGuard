# DriftGuard Backend

FastAPI + Python implementation of the deterministic, fault-tolerant
control-system simulation. See [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
for the baseline architecture and [`../docs/ARCHITECTURE_DIAGRAM.md`](../docs/ARCHITECTURE_DIAGRAM.md)
for the source-mapped block diagram.

## Layout

```
app/
  api/             # FastAPI routers, dependencies, error handling
  core/            # ids, time, exceptions, config, RNG, canonical
  domain/          # enums, dataclasses (models, events)
  simulation/      # vehicle, sensors, navigation pipeline, controllers,
                   # voting, faults, counter + trust detection, safe
                   # mode, anomaly sidecar, event logger, orchestrator
  scenarios/       # scenario registry, runner, YAML loader
  reporting/       # mission report (JSON + Markdown)
  persistence/     # SQLite schema and repository
  tests/           # pytest suite (incl. property / fuzz / soak)
```

## Run

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API: `http://localhost:8000` — interactive docs at `/docs`.

## Tests

```bash
pytest -q                # full suite (~9s on CI)
pytest --cov=app -q      # with coverage
pytest -m slow           # opt-in fuzz / soak / property tests
```

Coverage spans voting, controllers, fault detection (counter +
windowed trust), safe mode and recovery hysteresis, end-to-end
simulation determinism, the 15 fault types and their DSL, scenario
determinism, persistence + timeline reconstruction, mission report
sections, API contracts, replay fingerprinting, and the
structured-logging contract.

## Notes

- The default SQLite database is in-memory and resets between
  processes. Set `SENTINEL_DB_PATH` to a file path to persist; the
  database promotes to WAL mode on first connect.
- The orchestrator runs the full control loop and exposes a typed
  `StepRecord` per tick.
