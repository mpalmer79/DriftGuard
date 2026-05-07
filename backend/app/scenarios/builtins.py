"""Built-in scenario definitions.

Each function returns a Scenario. The registry imports these and
registers them at import time. Keeping the data here means
`registry.py` stays small and the actual scenario library is easy
to grep.
"""

from ..domain.enums import FaultType, SystemMode
from .models import Scenario, ScenarioFault


def nominal_cruise() -> Scenario:
    return Scenario(
        name="nominal_cruise",
        description="Steady-state cruise with no faults injected.",
        expected_behavior="System remains in NORMAL mode for the full run.",
        seed=42,
        steps=20,
        expected_final_modes=[SystemMode.NORMAL],
    )


def single_controller_latency() -> Scenario:
    return Scenario(
        name="single_controller_latency",
        description="Controller B exceeds the latency budget for several steps.",
        expected_behavior="System rejects controller_b and may degrade as latency persists.",
        seed=11,
        steps=15,
        faults=[
            ScenarioFault(
                type=FaultType.CONTROLLER_LATENCY,
                target="controller_b",
                start_step=2,
                duration=10,
                metadata={"latency_ms": 250.0},
            )
        ],
        expected_final_modes=[SystemMode.NORMAL, SystemMode.DEGRADED, SystemMode.SAFE_MODE],
    )


def sensor_drift_recovery() -> Scenario:
    return Scenario(
        name="sensor_drift_recovery",
        description="Sensor altitude drifts upward, then the fault clears.",
        expected_behavior="Sensor health degrades, system restricts unsafe actions, then recovers.",
        seed=23,
        steps=25,
        faults=[
            ScenarioFault(
                type=FaultType.SENSOR_DRIFT,
                target="sensor",
                start_step=3,
                duration=8,
                metadata={"magnitude": 4.0},
            )
        ],
        expected_final_modes=[SystemMode.NORMAL, SystemMode.DEGRADED, SystemMode.SAFE_MODE],
    )


def split_vote_escalation() -> Scenario:
    return Scenario(
        name="split_vote_escalation",
        description="Controllers repeatedly disagree because controller_b is action-biased.",
        expected_behavior="Vote splits frequently and the system enters SAFE_MODE.",
        seed=8,
        steps=15,
        faults=[
            ScenarioFault(
                type=FaultType.CONTROLLER_ACTION_BIAS,
                target="controller_b",
                start_step=1,
                duration=15,
                metadata={"forced_action": "ABORT"},
            ),
            ScenarioFault(
                type=FaultType.CONTROLLER_ACTION_BIAS,
                target="controller_c",
                start_step=2,
                duration=15,
                metadata={"forced_action": "TURN_RIGHT"},
            ),
        ],
        expected_final_modes=[SystemMode.SAFE_MODE, SystemMode.FAILED, SystemMode.DEGRADED],
    )


def multi_fault_failure() -> Scenario:
    return Scenario(
        name="multi_fault_failure",
        description="Sensor drift plus two controller failures.",
        expected_behavior="System escalates through DEGRADED and SAFE_MODE into FAILED.",
        seed=5,
        steps=20,
        faults=[
            ScenarioFault(
                type=FaultType.SENSOR_DROPOUT,
                target="sensor",
                start_step=3,
                duration=20,
                metadata={"probability": 0.6},
            ),
            ScenarioFault(
                type=FaultType.CONTROLLER_INVALID_OUTPUT,
                target="controller_a",
                start_step=4,
                duration=20,
            ),
            ScenarioFault(
                type=FaultType.CONTROLLER_SILENT_FAILURE,
                target="controller_b",
                start_step=6,
                duration=20,
            ),
        ],
        expected_final_modes=[SystemMode.SAFE_MODE, SystemMode.FAILED],
    )


def intermittent_fault() -> Scenario:
    return Scenario(
        name="intermittent_fault",
        description="Controller_a flickers between healthy and faulty across the run.",
        expected_behavior="Health bounces between SUSPECT and RECOVERING; mode transitions visible.",
        seed=17,
        steps=24,
        faults=[
            ScenarioFault(
                type=FaultType.CONTROLLER_INVALID_OUTPUT,
                target="controller_a",
                start_step=2,
                duration=22,
                metadata={"intermittent_pattern": [1, 1, 0, 0, 1, 0]},
            )
        ],
        expected_final_modes=[
            SystemMode.NORMAL,
            SystemMode.DEGRADED,
            SystemMode.SAFE_MODE,
        ],
    )


def sensor_spike_transient() -> Scenario:
    return Scenario(
        name="sensor_spike_transient",
        description="A single-step sensor spike injects an outlier reading, then clears.",
        expected_behavior=(
            "Voter rejects the spike as an outlier. System stays in NORMAL or "
            "briefly enters DEGRADED before recovering. Demonstrates that "
            "transient sensor faults do not cause persistent state changes."
        ),
        seed=31,
        steps=15,
        faults=[
            ScenarioFault(
                type=FaultType.SENSOR_SPIKE,
                target="sensor",
                start_step=6,
                duration=1,
                metadata={"magnitude": 35.0},
            )
        ],
        expected_final_modes=[SystemMode.NORMAL, SystemMode.DEGRADED],
    )


def gps_denied_navigation() -> Scenario:
    return Scenario(
        name="gps_denied_navigation",
        description="GPS signal lost mid-mission, simulating jamming or urban canyon.",
        expected_behavior=(
            "System enters DEGRADED on signal loss as controllers fall back to "
            "inertial estimates. If GPS does not return within the budget, the "
            "system escalates to SAFE_MODE."
        ),
        seed=47,
        steps=20,
        faults=[
            ScenarioFault(
                type=FaultType.GPS_DENIED,
                target="gps",
                start_step=5,
                duration=15,
            )
        ],
        expected_final_modes=[SystemMode.DEGRADED, SystemMode.SAFE_MODE],
    )


def byzantine_low_confidence() -> Scenario:
    return Scenario(
        name="byzantine_low_confidence",
        description=(
            "Controller_c reports valid actions with persistently low confidence — "
            "the Byzantine case where a node responds but its outputs are unreliable."
        ),
        expected_behavior=(
            "Voter weights controller_c's contribution down. Provided controllers "
            "a and b agree, system stays in NORMAL. Demonstrates trust-weighted "
            "voting under partial controller compromise."
        ),
        seed=53,
        steps=20,
        faults=[
            ScenarioFault(
                type=FaultType.CONTROLLER_CONFIDENCE_DROP,
                target="controller_c",
                start_step=2,
                duration=18,
                metadata={"confidence": 0.15},
            )
        ],
        expected_final_modes=[SystemMode.NORMAL, SystemMode.DEGRADED],
    )


def compound_cascading_recovery() -> Scenario:
    return Scenario(
        name="compound_cascading_recovery",
        description=(
            "A sensor noise spike overlaps with a compound controller fault. "
            "Both faults clear; the system attempts to recover."
        ),
        expected_behavior=(
            "System enters DEGRADED at the noise onset. After both faults clear, "
            "health monitors observe clean readings for the recovery window and "
            "the system returns to NORMAL. Demonstrates bidirectional state "
            "transitions — escalation is not a one-way trip."
        ),
        seed=67,
        steps=30,
        faults=[
            ScenarioFault(
                type=FaultType.SENSOR_NOISE_SPIKE,
                target="sensor",
                start_step=5,
                duration=8,
                metadata={"magnitude": 6.0},
            ),
            ScenarioFault(
                type=FaultType.COMPOUND_FAULT,
                target="controller_b",
                start_step=7,
                duration=6,
                metadata={"offset": 25.0, "latency_ms": 80.0, "confidence": 0.4},
            ),
        ],
        expected_final_modes=[SystemMode.NORMAL, SystemMode.DEGRADED],
    )


ALL_BUILTINS = (
    nominal_cruise,
    single_controller_latency,
    sensor_drift_recovery,
    split_vote_escalation,
    multi_fault_failure,
    intermittent_fault,
    sensor_spike_transient,
    gps_denied_navigation,
    byzantine_low_confidence,
    compound_cascading_recovery,
)
