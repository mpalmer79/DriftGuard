# SentinelNav Physics Model

This page describes the vehicle dynamics, sensor models, and state
estimator that ship in the backend. It is intentionally honest about
what is and is not modeled. The point of SentinelNav is the
redundancy / safe-mode story (RESEARCH.md §3); the physics exists to
give that story credible inputs.

## Coordinate frame

A flat-earth East/North/Up frame. Position uses `position_x` for east,
`position_y` for north, and `altitude` for up. Heading 0° is east,
heading 90° is north (matching the existing legacy convention).
Curvature of the earth is irrelevant at the scales involved.

## Vehicle dynamics

The simulation has two paths:

### Legacy `apply_action` (default)

`backend/app/simulation/vehicle.py::apply_action` is the original
single-step kinematic update. Each `Action` is mapped to a fixed delta
on altitude, velocity, heading, pitch, or roll. One simulation step
applies one delta. This path drives every existing scenario and the
98 baseline tests at the time of Phase 2.

### 3-DOF integrator (opt-in, Phase 2.1 / 2.2)

`backend/app/simulation/dynamics/integrator.py::integrate_action` runs
a continuous-time integrator at a fixed substep (default: 10 substeps
of 0.1s per simulation step). Each `Action` becomes a commanded
state — vertical rate, forward acceleration, turn rate, target pitch,
target roll. The integrator drives the vehicle toward the command
using the primitives in `simulation/dynamics/__init__.py`:

- `step_altitude` — vertical-rate integration with a ground floor.
- `step_velocity` — forward-velocity integration; floors at zero.
- `step_heading` — turn-rate integration; wraps in [0, 360).
- `step_pitch`, `step_roll` — first-order lag toward target with
  structural clamps (`MAX_PITCH_DEG`, `MAX_ROLL_DEG`).
- `horizontal_displacement` — east/north displacement from speed and
  heading.

The integrator is opt-in. Existing scenarios stay on `apply_action`
so determinism contracts and tests remain stable. New scenarios that
exercise sensor fusion will switch to the integrator when they need
finer-grained dynamics.

### Limits

| Quantity | Limit |
| --- | --- |
| Roll | ±25° |
| Pitch | ±15° |
| Vertical rate | ±25 m/s |
| Forward acceleration | ±10 m/s² |
| Turn rate | ±5 °/s |
| Altitude floor | 0 m |
| Velocity floor | 0 m/s |

## Sensor stack

Three sensor channels live in the backend.

### Truth-sensor (legacy)

`simulation/sensors.py::SensorModel`. Reports a noisy snapshot of the
truth state every step. This is what every controller consumes today
and what the 98 baseline tests assert against. Phase 2's additional
channels do not displace it.

### Inertial Navigation System (Phase 2.3)

`simulation/ins.py::INS`. A simplified strapdown INS:

- `initialize(truth)` seeds the internal estimate.
- `update(truth)` advances the estimate by adding Gaussian noise to
  the per-step truth deltas and integrating.
- `correct(x, y, alt)` snaps the position back to a supplied value
  (used by the EKF after a GPS update).

The model is low-fidelity by design. A real INS measures specific
force and angular rate from accelerometers and gyros, with biases
that are themselves random walks. We collapse all of that into
per-axis Gaussian noise on the integrated quantities. The
qualitative behavior — error grows under GPS denial — is what
matters for the redundancy story and is what the tests pin.

### GPS (Phase 2.4)

`simulation/gps.py::GPS`. Reports position and velocity at a fixed
cadence (default: every 5 simulation steps). When a `GPS_DENIED`
fault targeting `"gps"` is active, the GPS reports unavailable for
the duration. Off-cadence steps also return unavailable readings;
the EKF skips those.

## State estimation (Phase 2.5)

`simulation/filtering/ekf.py::EKF` — three independent scalar Kalman
filters on East/North/Up. INS provides per-step predictions; GPS
provides slow but accurate measurement updates. Acceptance criteria:

- Under nominal conditions the estimate converges to truth within
  five steps (the GPS cadence). Pinned by `test_ekf.py`.
- Under `GPS_DENIED`, INS-alone error grows; once GPS returns, a
  single update brings the estimate back inside the measurement
  noise band. Also pinned.

The "extended" qualifier in EKF is conventional in nav literature.
The current implementation is linear because the position state is
linear; the name does not need to change if attitude is added later.

The estimator is **advisory**. Controllers consume the truth-sensor
today; switching them to the EKF is part of the deferred
controller-mode work (see `docs/BACKLOG.md`). The deterministic
safe-mode logic never reads from the EKF.

## Missions and waypoints (Phase 2.6)

`simulation/missions/` defines `Mission`, `Waypoint`, and
`MissionTracker`. Three built-ins:

- **short_hop** — A → B with one altitude change.
- **racetrack** — closed-loop circuit, four waypoints.
- **switchback** — zig-zag pattern.

The tracker advances the active waypoint when the vehicle is inside
the waypoint's `capture_radius`. Closed-loop missions wrap to the
start. Wiring missions into the controller decision logic is
deferred per `docs/BACKLOG.md`.

## Trajectory persistence (Phase 2.7)

Every simulation step persists a row to `vehicle_state` in SQLite.
`SimulationRepository.get_trajectory(sim_id)` returns the position
series ordered by step. The `GET /simulations/{id}/trajectory`
endpoint surfaces the same data for the frontend.

## What this model deliberately does not do

- No 6-DOF rigid-body dynamics. We model 3-DOF: position, scalar
  velocity with heading, attitude angles. No body-frame angular
  velocities, no aerodynamic surface forces.
- No real flight-dynamics simulator (JSBSim). RESEARCH.md §10 marks
  JSBSim as a future candidate; we have not integrated it.
- No real-time guarantees. The simulation is a fixed-step logical
  clock; wall-clock latency is not part of the model.
- No hardware-in-the-loop. No PX4, no MAVLink, no ROS.

## Determinism note

All randomness (sensor noise, INS noise, GPS noise) is sourced from
`core.rng.RngService.child(...)`. Same seed plus same scenario
produces the same trajectory and the same EKF estimate. See
`docs/DETERMINISM.md` and ADR 0006.
