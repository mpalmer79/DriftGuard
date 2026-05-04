# SentinelNav Architecture (v2)

## 1. Mission

SentinelNav is a deterministic, fault-tolerant control system simulation platform designed to model how mission-critical systems maintain safe operation under uncertainty, partial failure, and conflicting control signals.

The system simulates a vehicle receiving imperfect sensor data, processing that data through redundant controller modules, reaching decisions through consensus mechanisms, detecting faults over time, and transitioning into degraded or safe operational modes when system trust boundaries are violated.

This project reflects aerospace and defense-grade system thinking, emphasizing reliability, determinism, traceability, and controlled failure handling.

---

## 2. System Goals

- Redundant control architecture with independent decision paths  
- Deterministic simulation execution  
- Majority-based consensus with disagreement handling  
- Time-aware fault detection  
- Explicit state transitions (NORMAL → DEGRADED → SAFE_MODE → FAILED)  
- Full auditability  
- Strong separation of concerns  
- Expandability  

---

## 3. Non-Goals

- No real hardware control  
- No high-fidelity physics  
- No ML as primary decision authority  
- No UI-first development  
- No distributed system (initially)  

---

## 4. System Constraints

### Determinism
Same inputs must produce identical outputs.

### Safety Priority
Prefer safe mode over uncertain control decisions.

### Observability
All decisions must be reconstructable.

### Isolation
Components must not corrupt each other’s logic.

### Time Awareness
Latency must be tracked and enforced.

---

## 5. Architecture Overview

Client  
↓  
FastAPI Layer  
↓  
Simulation Orchestrator  
↓  
  Vehicle State Engine  
  Sensor Pipeline  
    Noise Model  
    Fault Injection  
  Controller Layer  
    Controller A (Conservative)  
    Controller B (Responsive)  
    Controller C (Balanced)  
  Voting Engine  
  Fault Detection Engine  
  State Transition Manager  
  Safe Mode Controller  
  Event Logger  
↓  
SQLite  

---

## 6. Control Loop

1. Load state  
2. Generate sensor reading  
3. Apply sensor faults  
4. Send to controllers  
5. Apply controller faults  
6. Collect outputs  
7. Enforce latency rules  
8. Vote  
9. Update fault detection  
10. Evaluate state transition  
11. Generate final decision  
12. Update state  
13. Log events  

---

## 7. Domain Models

### VehicleState
- simulation_id  
- step  
- timestamp  
- position_x  
- position_y  
- altitude  
- velocity  
- heading  
- pitch  
- roll  
- system_mode  
- last_action  

### SensorReading
- reading_id  
- step  
- altitude  
- velocity  
- heading  
- pitch  
- roll  
- confidence  
- status  
- fault_flags  

### ControllerOutput
- controller_id  
- step  
- action  
- confidence  
- reason_code  
- response_time_ms  
- valid  

### VoteResult
- outcome  
- selected_action  
- agreeing_controllers  
- rejected_controllers  
- reason  

### FaultRecord
- fault_id  
- type  
- target_component  
- severity  
- active  
- start_step  
- end_step  
- metadata  

### SystemDecision
- step  
- final_action  
- system_mode  
- safe_mode_active  
- justification  
- trusted_controllers  
- rejected_controllers  

---

## 8. Controller Contract

evaluate(sensor_reading) → ControllerOutput

Constraints:

- no shared state mutation  
- deterministic output  
- must respect latency threshold  

---

## 9. Voting Rules

- Remove invalid or timed-out controllers  
- < 2 valid → INSUFFICIENT_DATA  
- 2+ match → CONSENSUS  
- all differ → SPLIT  

---

## 10. Fault Detection

Tracks over time:

- disagreement frequency  
- latency violations  
- invalid outputs  
- sensor drift  

Severity:

- WARNING  
- CRITICAL  

---

## 11. State Transitions

NORMAL → DEGRADED → SAFE_MODE → FAILED  

NORMAL  
All components healthy  

DEGRADED  
One component unreliable  

SAFE_MODE  
No trusted decision possible  

FAILED  
System cannot operate safely  

---

## 12. Safe Mode

Triggers:

- no consensus  
- multiple failures  
- invalid sensors  

Behavior:

- restrict actions  
- stabilize system  
- log critical event  

---

## 13. Fault Injection

Types:

- SENSOR_DRIFT  
- SENSOR_SPIKE  
- CONTROLLER_BIAS  
- CONTROLLER_TIMEOUT  
- DATA_LOSS  

Example:

{
  target: controller_b  
  type: CONTROLLER_BIAS  
  start_step: 10  
  duration: 5  
}

---

## 14. Event Logging

Fields:

- event_id  
- step  
- timestamp  
- component  
- type  
- severity  
- message  
- metadata  

Types:

- SENSOR  
- CONTROLLER  
- VOTE  
- FAULT  
- MODE_CHANGE  
- DECISION  
- STATE  

---

## 15. API

POST /simulations  
POST /simulations/{id}/step  
POST /simulations/{id}/faults  
GET /simulations/{id}/state  
GET /simulations/{id}/events  

---

## 16. Persistence

Tables:

- simulations  
- vehicle_state  
- sensor_readings  
- controller_outputs  
- vote_results  
- fault_records  
- system_decisions  
- events  

---

## 17. Testing

Unit:
- voting  
- controller logic  
- fault detection  

Integration:
- normal flow  
- single failure  
- multi failure  

Edge:
- no controllers  
- invalid data  
- rapid faults  

---

## 18. Reliability

- deterministic seeds  
- no hidden global state  
- strict validation  
- append-only logs  

---

## 19. Tradeoffs

- majority voting over weighted  
- deterministic logic over ML  
- simple physics over realism  

---

## 20. Repo Structure

backend/  
frontend/  
docs/  

---

## 21. Roadmap

Phase 1: core  
Phase 2: persistence  
Phase 3: UI  
Phase 4: advanced faults  
Phase 5: polish  

---

## 22. Success Criteria

- redundancy is clear  
- failures are handled correctly  
- safe mode is justified  
- decisions are traceable
