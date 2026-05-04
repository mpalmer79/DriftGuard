from enum import Enum


class Action(str, Enum):
    HOLD = "HOLD"
    ASCEND = "ASCEND"
    DESCEND = "DESCEND"
    ACCELERATE = "ACCELERATE"
    DECELERATE = "DECELERATE"
    TURN_LEFT = "TURN_LEFT"
    TURN_RIGHT = "TURN_RIGHT"
    STABILIZE = "STABILIZE"
    ABORT = "ABORT"


class SystemMode(str, Enum):
    NORMAL = "NORMAL"
    DEGRADED = "DEGRADED"
    SAFE_MODE = "SAFE_MODE"
    FAILED = "FAILED"


class FaultType(str, Enum):
    SENSOR_DRIFT = "SENSOR_DRIFT"
    SENSOR_SPIKE = "SENSOR_SPIKE"
    CONTROLLER_BIAS = "CONTROLLER_BIAS"
    CONTROLLER_TIMEOUT = "CONTROLLER_TIMEOUT"
    DATA_LOSS = "DATA_LOSS"


class FaultSeverity(str, Enum):
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class SensorStatus(str, Enum):
    OK = "OK"
    DEGRADED = "DEGRADED"
    INVALID = "INVALID"


class VoteOutcome(str, Enum):
    CONSENSUS = "CONSENSUS"
    SPLIT = "SPLIT"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class EventType(str, Enum):
    SENSOR = "SENSOR"
    CONTROLLER = "CONTROLLER"
    VOTE = "VOTE"
    FAULT = "FAULT"
    MODE_CHANGE = "MODE_CHANGE"
    DECISION = "DECISION"
    STATE = "STATE"


class EventSeverity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


CONTROLLER_IDS = ("controller_a", "controller_b", "controller_c")
