# SentinelNav Overnight Build Plan

You are working inside the existing SentinelNav repository.

The backend foundation already exists and passes the current test suite. Do not restart the project. Do not replace working code unnecessarily. Extend the project into a portfolio-grade deterministic fault-tolerant navigation simulation platform.

You are in uninterrupted execution mode.

## Operating Rules

- Do not ask for clarification.
- Do not stop after small phases.
- Make reasonable engineering assumptions.
- Preserve all existing passing behavior.
- Add tests for every meaningful feature.
- Keep code clean, readable, and human-written.
- Avoid over-engineering, but build enough depth to make the project impressive.
- Do not leave placeholder functions.
- Do not create fake features that are not wired into the app.
- Update documentation as features are implemented.
- At the end, all tests must pass.

## Primary Objective

Transform SentinelNav from a backend simulation prototype into a full-stack, portfolio-grade simulation platform that demonstrates:

1. Redundant control architecture
2. Deterministic autonomous system simulation
3. Sensor faults and controller faults
4. Majority voting and disagreement handling
5. Safe mode escalation
6. Persistent audit trail
7. Scenario-driven testing
8. Replayable timeline
9. Operational dashboard
10. Exportable mission report
11. Deployment-ready project structure

## Phase 0: Repo Assessment and Safety Pass

Before changing code:

1. Read README.md, ARCHITECTURE.md, CLAUDE.md, backend README if present, all backend modules, and all tests.
2. Identify current API routes, simulation lifecycle, persistence model, domain models, event model, fault types, and safe mode behavior.
3. Preserve compatibility with all existing tests.
4. Add `docs/BUILD_NOTES.md` explaining what existed before this expansion and what this build pass adds.

## Phase 1: Strengthen Backend Architecture

Improve backend structure without breaking the app.

Target structure:

backend/app/api/
backend/app/core/
backend/app/domain/
backend/app/persistence/
backend/app/reporting/
backend/app/scenarios/
backend/app/simulation/
backend/tests/

Add or improve:

backend/app/api/dependencies.py
backend/app/api/errors.py
backend/app/core/exceptions.py
backend/app/core/time.py
backend/app/core/ids.py
backend/app/scenarios/
backend/app/reporting/

Requirements:

- Centralize ID generation.
- Centralize deterministic timestamp handling.
- Add typed application exceptions.
- Add consistent API error responses.
- Keep existing behavior working.
- Avoid unnecessary rewrites.

## Phase 2: Persistent Simulation Recovery

The current API should not depend only on in-memory simulation state.

Implement repository methods:

- get_simulation(simulation_id)
- list_simulations()
- get_step_records(simulation_id)
- get_faults(simulation_id)
- get_decisions(simulation_id)
- get_sensor_readings(simulation_id)
- get_controller_outputs(simulation_id)
- get_votes(simulation_id)
- get_events(simulation_id)

Add API routes:

- GET /simulations
- GET /simulations/{id}
- GET /simulations/{id}/decisions
- GET /simulations/{id}/faults
- GET /simulations/{id}/timeline

Acceptance criteria:

- Existing simulations can be queried from SQLite.
- Timeline output combines state, sensor reading, controller outputs, vote, decision, and events per step.
- Tests prove timeline reconstruction works.

## Phase 3: Scenario System

Create a scenario engine so users can run named mission profiles.

Add scenario models:

- Scenario
- ScenarioStep
- ScenarioFault
- ScenarioInitialState
- ScenarioResult

Create built-in scenarios:

1. nominal_cruise
   - No faults
   - Stable control behavior
   - Expected mode remains NORMAL

2. single_controller_latency
   - One controller exceeds latency threshold
   - Expected mode moves to DEGRADED or SAFE_MODE depending duration

3. sensor_drift_recovery
   - Sensor drift affects readings for several steps
   - System detects degraded trust and restricts unsafe action

4. split_vote_escalation
   - Controllers disagree repeatedly
   - System enters SAFE_MODE

5. multi_fault_failure
   - Sensor fault plus controller failures
   - System eventually enters FAILED

6. intermittent_fault
   - Fault appears, clears, then returns
   - Timeline shows escalation and recovery behavior

Add API routes:

- GET /scenarios
- GET /scenarios/{name}
- POST /scenarios/{name}/run
- POST /scenarios/{name}/run/{steps}

Acceptance criteria:

- Each scenario runs deterministically.
- Same seed plus same scenario produces same decisions and events.
- Scenario output includes final mode, number of steps, fault summary, decision summary, and event counts.

## Phase 4: Advanced Fault Injection

Expand fault support.

Support these fault types:

- sensor_noise_spike
- sensor_drift
- sensor_dropout
- controller_invalid_output
- controller_latency
- controller_confidence_drop
- controller_action_bias
- controller_silent_failure
- conflicting_controller
- compound_fault

Fault metadata should support:

- magnitude
- bias
- forced_action
- latency_ms
- confidence
- probability
- intermittent_pattern
- affected_fields

Rules:

- Faults must be deterministic.
- Fault behavior must be explainable through events.
- Faults must be visible through the API.
- Fault state must persist.

Acceptance criteria:

- Tests cover each major fault type.
- Injected faults produce observable changes in sensor readings, controller outputs, votes, or decisions.
- Fault events include metadata showing why the system changed behavior.

## Phase 5: Better Fault Detection and Recovery Logic

Improve fault detection from simple counters into time-windowed logic.

Add:

- Sliding window disagreement tracking
- Per-controller trust score
- Per-sensor confidence score
- Recovery cooldown
- Escalation thresholds
- De-escalation thresholds
- Repeated fault memory

Domain concepts:

- TrustState
- ComponentHealth
- HealthStatus
- DetectionFinding

Health statuses:

- HEALTHY
- SUSPECT
- DEGRADED
- CRITICAL
- RECOVERING

Acceptance criteria:

- A temporary fault does not permanently poison the system.
- Repeated faults escalate faster.
- Recovery requires stable behavior for multiple steps.
- Tests prove escalation and recovery logic.

## Phase 6: Mission Report Generator

Create report generation in:

backend/app/reporting/

Add:

- mission_report.py
- summary.py
- risk.py

Create API routes:

- GET /simulations/{id}/report
- GET /simulations/{id}/report/markdown
- GET /simulations/{id}/report/json

Report must include:

- Simulation ID
- Seed
- Total steps
- Initial state
- Final state
- Final system mode
- All injected faults
- Mode transition timeline
- Controller trust summary
- Sensor health summary
- Vote outcome counts
- Rejected controller counts
- Critical events
- Final safety assessment
- Deterministic reproducibility note

Acceptance criteria:

- Reports are generated from persisted data, not only live memory.
- Tests verify report sections exist.
- Markdown report is readable and professional.

## Phase 7: Frontend App

Create a frontend application.

Use:

- Next.js
- TypeScript
- Tailwind CSS

Create:

frontend/app/
frontend/components/
frontend/lib/
frontend/types/

Pages:

1. /
   - Project landing page
   - Explain SentinelNav in plain language
   - Link to dashboard and scenarios

2. /dashboard
   - List simulations
   - Create simulation
   - Run one step
   - Run multiple steps
   - Show current state
   - Show current mode
   - Show latest decision

3. /scenarios
   - List built-in scenarios
   - Run scenario
   - Show scenario description
   - Show expected behavior

4. /simulations/[id]
   - Detailed simulation view
   - Current vehicle state
   - Faults
   - Decisions
   - Events
   - Timeline

5. /simulations/[id]/replay
   - Step-by-step replay of simulation timeline
   - Show sensor reading
   - Show controller outputs
   - Show vote result
   - Show final decision
   - Show system mode transition

6. /simulations/[id]/report
   - Render mission report
   - Copy markdown button
   - Download JSON button if simple to implement

Frontend components:

- SystemModeBadge
- VehicleStateCard
- ControllerOutputTable
- VoteResultCard
- FaultTimeline
- EventTimeline
- ScenarioCard
- MissionReportView
- StepReplayControls
- TrustScorePanel

Acceptance criteria:

- Frontend builds successfully.
- Frontend talks to backend through a typed API client.
- UI uses real backend data.
- No fake-only dashboard.

## Phase 8: API Client and Shared Types

Create frontend API client:

frontend/lib/api.ts
frontend/types/api.ts

Requirements:

- All backend calls go through the API client.
- Use typed responses.
- Handle errors cleanly.
- Expose backend URL through environment configuration.
- Include useful error messages when backend is unreachable.

Required methods:

- listSimulations()
- createSimulation()
- stepSimulation(id)
- injectFault(id, payload)
- getSimulation(id)
- getTimeline(id)
- listScenarios()
- getScenario(name)
- runScenario(name, steps)
- getReport(id)
- getMarkdownReport(id)

## Phase 9: Deployment Readiness

Add deployment assets.

Create or update:

- README.md
- backend/README.md
- frontend/README.md
- docs/DEPLOYMENT.md
- docs/API.md
- docs/SCENARIOS.md
- docs/FAULT_MODEL.md
- docs/PORTFOLIO_CASE_STUDY.md
- .env.example
- backend/.env.example
- frontend/.env.example

Add Docker support if reasonable:

- backend/Dockerfile
- frontend/Dockerfile
- docker-compose.yml

Documentation must explain:

- What SentinelNav is
- Why redundant control systems matter
- How the simulation loop works
- How voting works
- How faults are injected
- How safe mode escalation works
- How to run backend tests
- How to run frontend
- How to run scenarios
- How to read the mission report
- What makes this portfolio-worthy

## Phase 10: Testing Expansion

Add or expand tests.

Backend test targets:

- persistence recovery
- timeline reconstruction
- scenario determinism
- all new fault types
- report generation
- safe mode escalation
- safe mode recovery
- API route contracts
- event logging
- invalid input handling

Frontend test targets if test tooling is already simple to add:

- API client shape
- component rendering smoke tests
- scenario page smoke test
- dashboard smoke test

Do not spend excessive time fighting frontend test tooling. Backend tests matter most.

Acceptance criteria:

- Existing 29 tests still pass.
- New backend tests pass.
- Test count should grow meaningfully.
- No broken imports.
- No dead modules.

## Phase 11: Portfolio Polish

Improve public presentation.

README must include:

- Project title
- One-paragraph executive summary
- Architecture diagram in text or Mermaid
- Features
- Backend routes
- Scenario examples
- Fault model examples
- Screenshots placeholder section
- Local setup
- Test command
- Deployment notes
- Portfolio positioning paragraph

Add `docs/PORTFOLIO_CASE_STUDY.md` with:

- Problem
- Why this matters
- System design
- Simulation architecture
- Safety model
- Fault handling
- Tradeoffs
- What I would improve next
- Skills demonstrated

Keep this written in a professional but natural voice.

## Phase 12: Final Validation

Run:

- backend tests
- frontend build
- lint/type checks if configured

Fix failures.

At the end, provide a final summary containing:

- Files changed
- Features added
- Tests added
- Commands run
- Known tradeoffs
- Recommended next steps

Do not claim success unless tests and builds actually pass.
