# DriftGuard Architecture Diagram

This diagram is generated from a code-walkthrough of the repository as it
currently exists; it is not an idealized target architecture. Every node
label includes the source file (or directory) so a reviewer can audit the
diagram against real modules. Edges represent actual call paths exercised
by `backend/app/simulation/orchestrator.py` and the FastAPI routers in
`backend/app/api/`. Where the runtime behavior is advisory or out-of-band
(for example the anomaly sidecar), the edge style and label make that
explicit.

```mermaid
flowchart LR
    subgraph FE["Frontend (Next.js)"]
        UI["Dashboard & pages\n(frontend/app/)"]
        LIVE["Live SSE consumer\n(frontend/app/simulations/[id]/live/page.tsx)"]
        REPLAY["Replay viewer\n(frontend/app/simulations/[id]/replay/page.tsx)"]
        REPORT["Mission report viewer\n(frontend/app/simulations/[id]/report/page.tsx)"]
        PROXY["Auth proxy\n(frontend/app/api/proxy/[...path]/route.ts)"]
    end

    subgraph API["API layer (FastAPI)"]
        SIM["Simulations CRUD\n(api/routes.py)"]
        SCEN["Scenarios endpoints\n(api/scenario_routes.py)"]
        READ["Read / recovery\n(api/recovery_routes.py)"]
        REP["Mission report\n(api/report_routes.py)"]
        HEALTH["Health & metrics\n(api/health_routes.py)"]
        STREAM["SSE stream\n(api/stream_routes.py)"]
        AUTH["Bearer guard\n(api/auth.py)"]
        RL["Rate limiter\n(api/rate_limit.py)"]
    end

    subgraph SR["Scenario runner"]
        REG["Registry / run\n(scenarios/registry.py)"]
        BUILT["Built-in scenarios\n(scenarios/builtins.py)"]
        YAML["YAML loader\n(scenarios/loader.py)"]
    end

    subgraph KERNEL["Simulation kernel"]
        ORCH["Orchestrator step loop\n(simulation/orchestrator.py)"]
        NAV["Navigation pipeline\n(simulation/navigation.py + filtering/ekf.py)"]
        INS["INS / GPS sources\n(simulation/ins.py, gps.py)"]
        SENS["Sensor model\n(simulation/sensors.py)"]
        CTRLS["Controllers A / B / C\n(simulation/controllers.py)"]
        VOTE["Voter\n(simulation/voting.py)"]
        DET["FaultDetector\n(simulation/detection.py)"]
        TRUST["TrustDetector\n(simulation/health.py)"]
        SAFE["SafeModeManager\n(simulation/safe_mode.py)"]
        ANOM["AnomalySidecar (advisory)\n(simulation/anomaly_sidecar.py)"]
        VEH["Vehicle dynamics\n(simulation/vehicle.py + dynamics/integrator.py)"]
        EVT["EventLogger\n(simulation/event_logger.py)"]
    end

    subgraph EVID["Evidence & replay"]
        REPO["SimulationRepository\n(persistence/repository.py)"]
        DB[("SQLite\n(persistence/database.py)")]
        FP["Replay fingerprint\n(core/canonical.py -> /replay-fingerprint)"]
        MR["Mission report\n(reporting/mission_report.py)"]
    end

    subgraph OBS["Observability"]
        MET["Prometheus metrics\n(core/metrics.py -> /metrics)"]
        TRC["OpenTelemetry tracing (opt-in)\n(core/tracing.py)"]
        LOG["Structured logging\n(core/logging_setup.py)"]
    end

    UI --> PROXY
    LIVE --> PROXY
    REPLAY --> PROXY
    REPORT --> PROXY
    PROXY --> AUTH
    AUTH --> RL
    RL --> SIM
    RL --> SCEN
    RL --> READ
    RL --> REP
    RL --> STREAM
    UI --> HEALTH

    SCEN --> REG
    REG --> BUILT
    REG --> YAML
    SIM --> ORCH
    SCEN --> ORCH
    STREAM --> ORCH

    ORCH --> SENS
    ORCH --> NAV
    NAV --> INS
    NAV --> SENS
    SENS --> CTRLS
    CTRLS --> VOTE
    VOTE --> DET
    VOTE --> TRUST
    DET --> SAFE
    TRUST --> SAFE
    SAFE --> ORCH
    ORCH --> VEH
    ORCH -. advisory only, never gates decision .-> ANOM
    ANOM --> EVT
    ORCH --> EVT

    ORCH --> REPO
    EVT --> REPO
    REPO --> DB
    READ --> REPO
    REP --> MR
    MR --> REPO
    READ --> FP
    FP --> REPO

    ORCH --> MET
    ORCH --> TRC
    ORCH --> LOG
    HEALTH --> MET
```

## Legend / file map

- Frontend pages: `frontend/app/page.tsx`, `frontend/app/dashboard/page.tsx`,
  `frontend/app/scenarios/page.tsx`, `frontend/app/scenarios/new/page.tsx`,
  `frontend/app/simulations/[id]/page.tsx`,
  `frontend/app/simulations/[id]/live/page.tsx`,
  `frontend/app/simulations/[id]/replay/page.tsx`,
  `frontend/app/simulations/[id]/report/page.tsx`.
- Auth proxy: `frontend/app/api/proxy/[...path]/route.ts` injects the
  bearer token server-side so it never reaches the browser.
- API entrypoint: `backend/app/main.py` wires the routers above.
- Bearer guard scope: `api/auth.py::require_write_auth` is applied only to
  state-mutating endpoints (POST/DELETE); GET endpoints stay open by design.
- Replay fingerprint: `GET /simulations/{sim_id}/replay-fingerprint`
  hashes the canonical run record from `core/canonical.py`. Same seed and
  scenario produce the same hash.
- Anomaly sidecar: emits advisory events but `orchestrator.py` never
  consults its score when picking the final action; the voter, fault
  detector, trust detector and safe-mode manager are the only inputs to
  the gating decision.
- Persistence: a single SQLite file per replica
  (`persistence/database.py`), accessed via `SimulationRepository`. There
  is no shared state between replicas; see `docs/DEPLOYMENT.md` for the
  single-replica boundary.
- Observability: `/metrics` is always on; OpenTelemetry tracing is
  opt-in via environment configuration in `core/tracing.py`.
