from dataclasses import dataclass


@dataclass(frozen=True)
class SimulationConfig:
    latency_threshold_ms: float = 50.0
    sensor_noise_std: float = 0.5
    disagreement_warning_threshold: int = 3
    disagreement_critical_threshold: int = 6
    invalid_warning_threshold: int = 2
    invalid_critical_threshold: int = 4
    safe_mode_recovery_steps: int = 5
    default_seed: int = 42


DEFAULT_CONFIG = SimulationConfig()
