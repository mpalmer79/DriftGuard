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


ALL_BUILTINS = (
    nominal_cruise,
    single_controller_latency,
    sensor_drift_recovery,
    split_vote_escalation,
    multi_fault_failure,
    intermittent_fault,
)
