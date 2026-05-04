# SentinelNav Technical Whitepaper

## Autonomous Navigation Safety, Fault Tolerance, and Decision Assurance

## Executive Summary

SentinelNav should be scoped as a high-assurance, fault-tolerant flight-control and navigation simulation platform for portfolio use. It should not be positioned as a consumer drone app, a SaaS product, or certifiable airborne software. Its value is demonstrating principal-level systems thinking under mission-critical constraints.

The project should emphasize:

- deterministic execution
- bounded timing
- safety envelope protection
- auditability
- adversarial resilience
- reproducible experiments
- controlled degradation under failure

Public information from Draper shows that its work centers on guidance, navigation, control, strategic navigation, GPS-denied systems, autonomous systems, space systems, and fault-tolerant computing. SentinelNav aligns with that world if it foregrounds reliability engineering over UI polish.

The strongest 2024 to 2026 pattern across aerospace, robotics, autonomy, and defense research is hybrid assurance. Classical control and estimation are still foundational, but modern systems increasingly wrap them with runtime assurance, deterministic simulation, fault injection, replayable logs, trust scoring, and secure communications.

The core architectural conclusion is:

SentinelNav should become a deterministic safety and decision-assurance kernel for autonomous systems.

The right build order is:

1. Kernel first
2. Evidence second
3. UI last

---

## 1. Purpose and Scope

SentinelNav is best defined as a redundant flight-control and navigation simulation environment whose main artifact is evidence.

That evidence includes:

- deterministic replay logs
- fault timelines
- controller vote traces
- safety-mode transitions
- scenario manifests
- reproducibility reports
- decision explanations

The goal is not to replicate a production autopilot. The goal is to prove that the system designer understands how mission software behaves when:

- sensors drift
- messages arrive late
- controllers disagree
- a component behaves maliciously
- the system must degrade safely
- an operator must reconstruct why a fallback mode was chosen

SentinelNav should be treated as a mission-assurance simulator.

---

## 2. What Draper Is

Draper is a nonprofit engineering organization based in Cambridge, Massachusetts. Publicly, Draper emphasizes:

- guidance, navigation, and control
- strategic systems
- space systems
- human spaceflight and exploration
- GPS-denied navigation
- resilient autonomous systems
- precision sensing
- fault-tolerant computing

Relevant public Draper pages include:

- https://www.draper.com/
- https://www.draper.com/what-we-do
- https://www.draper.com/market-areas/electronic-systems/gnc-solutions
- https://www.draper.com/market-areas/strategic-systems
- https://www.draper.com/market-areas/space-systems
- https://www.draper.com/market-areas/space-systems/human-spaceflight-and-exploration
- https://www.draper.com/media-center/news-releases/detail/27330/draper-completes-pre-production-testing-of-its-celestial-navigation-system-for-aircraft

Draper is not a normal software company. It is closer to a mission engineering lab that builds high-consequence systems where failure is unacceptable.

For SentinelNav, the lesson is clear:

Do not build a generic autonomy demo. Build a fault-aware, auditable, deterministic mission-control simulation.

---

## 3. Why SentinelNav Fits the Draper-Style Problem Space

Draper-adjacent work values:

- trusted navigation
- degraded-environment operation
- GPS-denied behavior
- deterministic control
- fault-tolerant computing
- auditability
- safety under uncertainty

SentinelNav maps well if it focuses on:

- redundant controllers
- bounded decision deadlines
- controller disagreement handling
- sensor drift detection
- safe-mode transitions
- deterministic replay
- structured evidence

Weak positioning:

"Autonomous flight simulator"

Strong positioning:

"Deterministic safety and decision-assurance kernel for autonomous control systems under sensor, timing, and controller failure."

---

## 4. Competitive Landscape

### 4.1 MIT Lincoln Laboratory

MIT Lincoln Laboratory publicly works on secure and resilient mission-critical cyber-physical systems, autonomous mobility, secure radios for uncrewed systems, and applied resilience for mission systems.

Relevant sources:

- https://www.ll.mit.edu/r-d/cyber-security-and-information-sciences/secure-resilient-systems-and-technology
- https://www.ll.mit.edu/r-d/projects/autonomous-mobility-through-intelligent-collaboration
- https://www.ll.mit.edu/r-d/projects/secure-radios-uncrewed-systems
- https://www.ll.mit.edu/r-d/projects/applied-resilience-mission-systems

SentinelNav lesson:

Add cyber-physical resilience, not just flight dynamics.

---

### 4.2 BAE Systems

BAE publicly emphasizes uncrewed systems, autonomy, cross-domain decision advantage, battle management, edge operations, and resilient defense systems.

Relevant sources:

- https://www.baesystems.com/en-us/product/uncrewed-air-systems
- https://www.baesystems.com/en-us/product/bmis-battlespace-management-and-intelligence-system
- https://www.baesystems.com/en/insight/cross-domain-is-the-glue-between-the-five-operational-domains
- https://www.baesystems.com/en/insight/countering-threats-2026-predictions

SentinelNav lesson:

Make disconnected-edge operation and cross-domain degradation explicit.

---

### 4.3 Northrop Grumman

Northrop Grumman publicly emphasizes assured navigation, GPS-jam-resistant systems, autonomous testbed ecosystems, and autonomous wingman work.

Relevant sources:

- https://www.northropgrumman.com/what-we-do/mission-solutions/assured-navigation
- https://news.northropgrumman.com/navigation-systems/northrop-grumman-delivers-resilient-airborne-navigation-system-resistant-to-gps-jamming
- https://news.northropgrumman.com/autonomous-systems/northrop-grumman-unveils-beacon-autonomous-testbed-ecosystem
- https://www.northropgrumman.com/what-we-do/aircraft/talon-iq

SentinelNav lesson:

Degraded navigation, GPS denial, and autonomy testbeds are highly relevant framing areas.

---

### 4.4 RTX / Raytheon / Collins Aerospace

RTX and Collins Aerospace publicly discuss collaborative mission autonomy, open systems avionics, semi-autonomous combat-air software, autonomy at the edge, and autonomous undersea systems.

Relevant sources:

- https://www.rtx.com/collinsaerospace/what-we-do/industries/military-and-defense/platforms/fighters-and-bombers/sixth-generation-fighter/collaborative-mission-autonomy
- https://www.rtx.com/collinsaerospace/what-we-do/industries/military-and-defense/open-systems-architecture-solutions
- https://www.rtx.com/news/news-center/2024/10/15/rtx-demonstrates-launched-effects-autonomy-at-edge
- https://www.rtx.com/raytheon/what-we-do/sea/barracuda-mine-neutralization-system

SentinelNav lesson:

Separate autonomy logic from platform specifics and build reusable safety interfaces.

---

### 4.5 Lockheed Martin

Lockheed Martin publicly discusses autonomous and unmanned systems, digital engineering simulation environments, AI-capable ISR platforms, autonomous Black Hawk work, drone control from fighter aircraft, and AI-driven mission contingency management.

Relevant sources:

- https://www.lockheedmartin.com/en-us/capabilities/autonomous-unmanned-systems.html
- https://www.lockheedmartin.com/en-us/products/arise-digital-engineering-simulation-environment.html
- https://www.lockheedmartin.com/en-us/who-we-are/business-areas/aeronautics/skunkworks/skunkworks-ai-autonomy.html
- https://news.lockheedmartin.com/2025-12-04-Lockheed-Martin-Skunk-Works-R-Showcases-AI-Driven-Mission-Contingency-Management-on-an-Autonomous-UAV-Demonstration

SentinelNav lesson:

Treat simulation as engineering infrastructure, not as a visual demo.

---

### 4.6 Honeywell Aerospace

Honeywell publicly discusses autonomous aviation, compact fly-by-wire systems, triplex architecture, lockstep processing, autonomous Black Hawk logistics, and next-generation avionics.

Relevant sources:

- https://aerospace.honeywell.com/us/en/products-and-services/products/cabin-and-cockpit/avionics/flight-management-systems/compact-fly-by-wire-flight-control-system
- https://aerospace.honeywell.com/us/en/about-us/blogs/the-future-of-autonomous-defense-capabilities
- https://www.honeywell.com/us/en/press/2025/01/honeywell-and-nxp-expand-partnership-to-accelerate-next-generation-aviation-technology
- https://aerospace.honeywell.com/us/en/about-us/press-release/2025/04/us-army-selects-near-earth-autonomy-and-honeywell-to-deliver-autonomous-black-hawk-logistics-solution

SentinelNav lesson:

Triplex control, lockstep execution, and avionics-style redundancy should be visible in the design.

---

## 5. Technology Trends Relevant to 2026

### 5.1 Assured Autonomy

The direction of the field is moving from:

"Can the autonomous system perform?"

to:

"Can the autonomous system prove bounded safe behavior under degraded conditions?"

This means SentinelNav should include:

- runtime assurance
- safety invariants
- explicit mode transitions
- evidence artifacts
- deterministic replay
- formalizable handoff logic

NASA runtime assurance material is especially relevant:

- https://ntrs.nasa.gov/citations/20240006522
- https://techport.nasa.gov/projects/93379

---

### 5.2 Runtime Assurance

Runtime assurance means an advanced or untrusted controller can operate normally, but a verified safe controller takes over when system invariants are threatened.

SentinelNav should model this pattern:

- advanced controller proposes action
- monitor checks safety envelope
- if unsafe, safe controller overrides
- event log records why

This is stronger than basic safe mode because it proves the system can reject unsafe behavior.

---

### 5.3 Deterministic Simulation

Modern mission systems increasingly depend on simulation-first engineering.

Relevant tools and concepts:

- JSBSim flight dynamics
- PX4 simulation and HITL
- Gazebo lockstep simulation
- Basilisk simulation
- deterministic replay
- fixed-step logical clocks

Sources:

- https://jsbsim-team.github.io/jsbsim-reference-manual/
- https://docs.px4.io/main/en/simulation/hitl
- https://docs.px4.io/main/en/sim_gazebo_gz/
- https://classic.gazebosim.org/tutorials?tut=lockstep_physics_sensors
- https://avslab.github.io/basilisk/

SentinelNav should not depend on wall-clock timing for mission truth. It should use a deterministic logical-time scheduler.

---

### 5.4 Secure Robotics and Vehicle Messaging

Mission systems need message validity, sequence numbers, timestamp checks, and replay protection.

Relevant technologies:

- ROS 2 DDS-Security
- MAVLink 2 message signing
- Cyphal / OpenCyphal
- authenticated command envelopes

Sources:

- https://docs.ros.org/en/rolling/Concepts/Intermediate/About-Security.html
- https://mavlink.io/en/guide/message_signing.html
- https://opencyphal.org/
- https://specification.opencyphal.org/Cyphal_Specification.pdf

SentinelNav should model secure message envelopes even if it does not implement a full ROS or MAVLink stack.

---

### 5.5 Append-Only Evidence Logs

A government-style portfolio project needs evidence, not just logs.

Relevant technology:

- MCAP robotics logging
- structured event storage
- replayable telemetry
- manifest-based scenario execution

Sources:

- https://mcap.dev/spec
- https://mcap.dev/guides

SentinelNav should treat event logs as source of truth. A database can be a read model, but append-only mission evidence should be authoritative.

---

### 5.6 Formal and Analytical Assurance

SentinelNav does not need full formal verification, but it should show awareness of it.

Relevant tools:

- TLA+ for state machines and protocol logic
- CBMC for bounded C/C++ checks
- PRISM for probabilistic model checking

Sources:

- https://lamport.azurewebsites.net/tla/tla.html
- https://www.cprover.org/cbmc/
- https://www.prismmodelchecker.org/

Recommended SentinelNav use:

- formalize mode transitions
- formalize handoff logic
- verify no impossible state transitions
- avoid trying to prove the whole system

---

## 6. Failure Modes SentinelNav Must Model

SentinelNav should not merely support "faults." It should organize faults as first-class experiments.

| Failure Mode | Example | Risk | Required Response |
|---|---|---|---|
| Sensor drift | IMU bias slowly increases | State estimate corruption | Confidence drop and sensor de-weighting |
| Sensor dropout | GPS unavailable | Loss of observability | Degraded mode |
| Latency spike | Controller responds late | Stale control action | Deadline rejection |
| Packet loss | Missing telemetry frame | Inconsistent state | Sequence validation |
| Replay attack | Old command resent | Unsafe command acceptance | Nonce or sequence rejection |
| Byzantine controller | Controller outputs arbitrary action | Unsafe vote contamination | Trust scoring and outlier detection |
| Clock skew | Components disagree on time | False disagreement | Logical-time scheduler |
| Resource exhaustion | Event storm or CPU spike | Cascading deadline failure | Backpressure and safe mode |
| Non-deterministic replay | Different replay output | Audit failure | Replay hash validation |

---

## 7. Recommended SentinelNav v3 Architecture

SentinelNav v3 should place an authoritative deterministic simulation kernel at the center.

Everything else should be outside the mission-critical loop.

Authoritative path:

1. Scenario manifest
2. Deterministic scheduler
3. Sensor model or replay stream
4. State estimation
5. Controller set
6. Consensus layer
7. Runtime assurance shell
8. Safe controller or actuator model
9. Append-only event log
10. Replay harness

Architecture sketch:

    Scenario Manifest
      seed
      vehicle profile
      fault schedule
      timing budgets
          |
          v
    Deterministic Scheduler
      fixed-step logical time
          |
          v
    Sensor Bus
      IMU
      GPS
      barometer
      vision
      comms
          |
          v
    Estimator Stack
      EKF or UKF authoritative
      particle filter recovery optional
      anomaly detector advisory only
          |
          v
    Controller Set
      Conservative controller
      Responsive controller
      Balanced controller
      Safe controller
          |
          v
    Hybrid Consensus Layer
      deadline-bound voting
      trust scoring
      disagreement accounting
          |
          v
    Runtime Assurance Shell
      invariants
      safety envelope
      mode manager
          |
          v
    Vehicle / Actuator Model
          |
          v
    Append-Only Event Log
          |
          v
    Replay Harness and Audit Console

Key rule:

The UI must never define system truth.

The UI reads evidence. The kernel produces evidence.

---

## 8. Concrete Changes from SentinelNav v2 to v3

| Area | v2 Direction | v3 Direction | Reason |
|---|---|---|---|
| Scheduler | Wall-clock loop | Fixed-step logical-time executor | Required for deterministic replay |
| State estimation | Basic sensor values | EKF/UKF baseline with outlier gates | More credible autonomy modeling |
| Redundancy | 2-of-3 voting | Deadline-bound vote plus trust decay | Handles stale and bad controllers |
| Safety | Threshold checks | Runtime assurance shell | Turns detection into mitigation |
| Messaging | Internal data passing | Message envelopes with sequence and timestamp | Enables replay and spoof defense |
| Logging | Mutable events | Append-only event evidence | Auditability |
| Verification | Unit tests only | TLA+ mode model and property tests | Stronger systems signal |
| Simulation | Simple physics | JSBSim or deterministic physics wrapper | Better flight relevance |
| UI | Dashboard-driven | Observer-only audit console | Prevents UI-first weakness |

---

## 9. Recommended Technology Stack

### Kernel and Simulation

Preferred:

- Python for initial deterministic kernel
- JSBSim for credible flight dynamics
- Gazebo later for sensor realism
- PX4 HITL later for real autopilot interface credibility

### API

Use FastAPI as an inspection sidecar, not as the core mission loop.

Source:

- https://fastapi.tiangolo.com/

### Evidence

Use append-only logs. Consider MCAP-style structure even if you start with JSONL.

Source:

- https://mcap.dev/spec

### Storage

Use:

- SQLite for local catalog and metadata
- DuckDB for post-run analysis
- PostgreSQL later if collaboration or deployed read models become necessary

Sources:

- https://sqlite.org/about.html
- https://duckdb.org/
- https://www.postgresql.org/about/

### Formal Modeling

Use:

- TLA+ for mode transition logic
- property-based tests for runtime invariants
- optional PRISM later for probabilistic studies

---

## 10. Candidate Technology Comparison

| Candidate | Role | Strength | Weakness | SentinelNav Recommendation |
|---|---|---|---|---|
| JSBSim | Flight dynamics | Lightweight and flight-relevant | Adds integration complexity | Strong candidate for v3 |
| PX4 | Autopilot/HITL | Real-world credibility | Heavy setup | Later phase |
| Gazebo | Sensor and physics simulation | Rich robotics ecosystem | Can become distracting | Use after kernel is stable |
| Basilisk | Aerospace simulation inspiration | Strong for mission simulation concepts | More specialized | Study as reference |
| ROS 2 DDS-Security | Secure robotics middleware | Real secure comms pattern | Heavy for MVP | Use concepts, not full dependency |
| MAVLink signing | Lightweight command signing pattern | Practical for vehicle messaging | Narrow protocol scope | Use as design reference |
| MCAP | Robotics log format | Strong audit story | Adds format learning | Highly recommended |
| TLA+ | Formal state modeling | Strong for mode transitions | Learning curve | Use for one focused model |
| DuckDB | Post-run analytics | Excellent for logs and experiments | Not mission runtime | Use for analysis layer |

---

## 11. Experiments and Success Criteria

SentinelNav should prove behavior through experiments.

| Experiment | Fault Condition | Metric | Pass Criterion |
|---|---|---|---|
| Deterministic replay | Same seed repeated 10 times | Output hash equality | 10/10 identical |
| Sensor drift containment | Gradual GPS or IMU drift | Alert timing | Fault detected before safety breach |
| Sensor dropout | GPS unavailable | Mode transition | Enters DEGRADED or SAFE_MODE |
| Byzantine controller | One controller outputs unsafe actions | Vote stability | Unsafe command rejected |
| Latency spike | Controller response delayed | Deadline rejection | Late output excluded |
| Replay attack | Old valid command resent | Acceptance rate | 0 accepted replay commands |
| Packet loss | Random telemetry loss | Safe-mode behavior | No silent unsafe action |
| Envelope violation | Aggressive maneuver | Safety invariant | Override or safe mode triggered |

Suggested portfolio targets:

- deterministic replay: identical output across repeated runs
- controller vote latency: bounded within configured budget
- mode transition: reason-coded and logged
- safe-mode activation: explainable from event log
- Byzantine tolerance: one bad controller cannot force unsafe output

---

## 12. Evidence Artifacts to Generate

Each major scenario should export:

- scenario manifest
- event log
- vote trace
- safety timeline
- controller comparison report
- fault timeline
- replay verdict
- run hash
- environment metadata
- decision explanation report

These artifacts matter more than the dashboard.

A principal-level reviewer should be able to inspect the evidence and understand:

- what happened
- why it happened
- which component was trusted
- which component was rejected
- why the system entered degraded or safe mode
- whether the run is reproducible

---

## 13. What Makes SentinelNav Cutting Edge

SentinelNav becomes cutting edge if it combines:

1. deterministic simulation
2. runtime assurance
3. redundant controller arbitration
4. adversarial fault injection
5. secure message validity checks
6. replayable evidence logs
7. measurable reliability metrics
8. observer-only audit UI

The project should not chase fashionable AI. The modern direction is not "LLM controls vehicle."

The modern direction is:

"AI or advanced controllers may advise, but deterministic assurance governs."

---

## 14. Where the Project Could Fall Short

### Risk 1: UI-First Drift

If the project becomes a dashboard, it loses seriousness.

Mitigation:

Build kernel and evidence before UI.

### Risk 2: Toy Physics

If flight behavior is too fake, the system looks shallow.

Mitigation:

Introduce JSBSim or clearly document simplified physics assumptions.

### Risk 3: Naive Voting

Basic majority voting is useful, but not enough.

Mitigation:

Add deadlines, validity checks, trust decay, and reason-coded rejection.

### Risk 4: No Metrics

Without experiments, claims are unproven.

Mitigation:

Build scenario-based test reports.

### Risk 5: Overusing AI

Adding an LLM too early weakens the mission-critical story.

Mitigation:

Keep AI advisory only, never authoritative.

---

## 15. Strategic Positioning

Weak positioning:

"Autonomous drone simulator."

Better positioning:

"Fault-tolerant autonomous navigation simulator."

Best positioning:

"Deterministic decision-assurance kernel for autonomous control systems under sensor, controller, timing, and adversarial failure."

This phrasing aligns better with:

- Draper
- MIT Lincoln Laboratory
- Northrop Grumman
- RTX
- Lockheed Martin
- Honeywell Aerospace
- advanced robotics
- cyber-physical systems
- mission assurance engineering

---

## 16. Repository Report Recommendation

This report should live in the repo as:

docs/RESEARCH_REPORT.md

Related documents should include:

- docs/ARCHITECTURE.md
- docs/FAILURE_MODEL.md
- docs/ASSURANCE_MODEL.md
- docs/SCENARIO_MANIFEST.md
- docs/REPLAY_AND_EVIDENCE.md
- docs/COMPETITIVE_LANDSCAPE.md

The research report should explain why the project exists.

The architecture file should explain how it is built.

The failure model should explain what it tests.

The assurance model should explain why decisions can be trusted.

---

## 17. Bottom-Line Recommendation

SentinelNav should not be built as a SaaS app, AI demo, or generic simulator.

It should be built as a portfolio-grade mission assurance system.

The most important sentence for the entire project is:

The system does not merely make autonomous decisions; it determines whether autonomous decisions are safe, explainable, and trustworthy under failure.

That is the project.

---

## 18. Source Index

Draper:

- https://www.draper.com/
- https://www.draper.com/what-we-do
- https://www.draper.com/market-areas/electronic-systems/gnc-solutions
- https://www.draper.com/market-areas/strategic-systems
- https://www.draper.com/market-areas/space-systems
- https://www.draper.com/market-areas/space-systems/human-spaceflight-and-exploration
- https://www.draper.com/media-center/news-releases/detail/27330/draper-completes-pre-production-testing-of-its-celestial-navigation-system-for-aircraft

Mission and autonomy competitors:

- https://www.ll.mit.edu/r-d/cyber-security-and-information-sciences/secure-resilient-systems-and-technology
- https://www.baesystems.com/en-us/product/uncrewed-air-systems
- https://www.northropgrumman.com/what-we-do/mission-solutions/assured-navigation
- https://www.rtx.com/collinsaerospace/what-we-do/industries/military-and-defense/platforms/fighters-and-bombers/sixth-generation-fighter/collaborative-mission-autonomy
- https://www.lockheedmartin.com/en-us/capabilities/autonomous-unmanned-systems.html
- https://aerospace.honeywell.com/us/en/products-and-services/products/cabin-and-cockpit/avionics/flight-management-systems/compact-fly-by-wire-flight-control-system

Simulation and HITL:

- https://jsbsim-team.github.io/jsbsim-reference-manual/
- https://docs.px4.io/main/en/simulation/hitl
- https://docs.px4.io/main/en/sim_gazebo_gz/
- https://classic.gazebosim.org/tutorials?tut=lockstep_physics_sensors
- https://avslab.github.io/basilisk/

Security and messaging:

- https://docs.ros.org/en/rolling/Concepts/Intermediate/About-Security.html
- https://mavlink.io/en/guide/message_signing.html
- https://opencyphal.org/

Evidence and logging:

- https://mcap.dev/spec
- https://mcap.dev/guides

Assurance and formal methods:

- https://ntrs.nasa.gov/citations/20240006522
- https://techport.nasa.gov/projects/93379
- https://lamport.azurewebsites.net/tla/tla.html
- https://www.cprover.org/cbmc/
- https://www.prismmodelchecker.org/

Data and analysis:

- https://sqlite.org/about.html
- https://duckdb.org/
- https://www.postgresql.org/about/

## Final Conclusion

The right move is to engineer the kernel first, evidence second, and UI last.
