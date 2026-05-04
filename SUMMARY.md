Summary
Implements the SentinelNav backend per ARCHITECTURE.md across all execution phases.

Domain layer: VehicleState, SensorReading, ControllerOutput, VoteResult, FaultRecord, SystemDecision, Event, plus enums for actions, modes, fault types, sensor status, vote outcomes, event types/severities.
Simulation core: deterministic vehicle state engine, noisy sensor model with fault hooks, controller interface and three differing controllers (controller_a conservative, controller_b responsive, controller_c balanced).
Decision system: majority-vote engine that drops invalid/late controllers, fault registry for injection, time-aware fault detector with WARNING/CRITICAL escalation, safe mode manager driving NORMAL → DEGRADED → SAFE_MODE → FAILED transitions and action restriction.
Orchestrator: runs the full control loop in spec order, produces a SystemDecision per step, advances vehicle state, and logs structured events.
API: FastAPI app exposing POST /simulations, POST /simulations/{id}/step, POST /simulations/{id}/faults, GET /simulations/{id}/state, GET /simulations/{id}/events, plus /health.
Persistence: SQLite schema and repository for simulations, vehicle state, sensor readings, controller outputs, votes, faults, decisions, and events.
Tests: 29 pytest cases covering voting, controllers, fault detection, safe mode, end-to-end simulation flow, determinism, and the API.
Test plan
 pytest -q (29 passed)
 FastAPI app loads and exposes the spec'd routes
 Optional: uvicorn app.main:app and exercise endpoints manually
https://claude.ai/code/session_011UdSajDSJxKtzCNaH7BpxR
