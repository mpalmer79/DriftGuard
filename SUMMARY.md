# Repository summary

DriftGuard is a deterministic, fault-tolerant control-system
simulation. The original baseline followed
[`ARCHITECTURE.md`](ARCHITECTURE.md); subsequent work is rolled up in
[`CHANGELOG.md`](CHANGELOG.md), and the per-phase log lives in
[`docs/BUILD_NOTES.md`](docs/BUILD_NOTES.md).

Shape of the codebase:

- **Domain** — typed dataclasses (`VehicleState`, `SensorReading`,
  `ControllerOutput`, `VoteResult`, `FaultRecord`, `SystemDecision`,
  `Event`) and the enums that drive them.
- **Simulation kernel** — vehicle dynamics, sensor model, three
  differing controllers (Conservative, Responsive, Balanced),
  majority voting, counter-based + windowed-trust detection,
  safe-mode manager (with recovery hysteresis), append-only event
  logger, and an orchestrator running the full step loop. The INS /
  GPS / EKF navigation pipeline is on the live path by default.
- **Scenarios + reporting** — built-in scenarios, YAML scenario
  loader, scenario runner, and the JSON / Markdown mission report.
- **API** — FastAPI app with typed schemas, an error taxonomy,
  optional bearer-token guard on writes, sliding-window rate
  limiter, CORS allowlist, and an SSE stream.
- **Persistence** — SQLite schema and repository covering
  simulations, vehicle state, sensor readings, controller outputs,
  votes, faults, decisions, and events. WAL on filesystem-backed
  deployments.
- **Tests** — 630 backend tests, 97 percent line coverage. Property
  tests, exhaustive transition checks, soak runs, and a subprocess
  fuzz harness are opt-in via the `slow` marker.

For onboarding, start at [`README.md`](README.md). The documentation
map there links the architecture diagram, demo script, determinism
audit, scenarios, API surface, invariants, ADRs, and deployment
runbooks.
