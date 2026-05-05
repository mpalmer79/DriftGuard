from dataclasses import dataclass


@dataclass(frozen=True)
class SimulationConfig:
    latency_threshold_ms: float = 50.0
    sensor_noise_std: float = 0.5
    disagreement_warning_threshold: int = 3
    disagreement_critical_threshold: int = 6
    invalid_warning_threshold: int = 2
    invalid_critical_threshold: int = 4
    # Phase 5.2: latency violations bucket independently from invalid
    # outputs. Defaults match the invalid_* thresholds so existing
    # behaviour is preserved; deployments can tune them separately
    # without dragging the invalid-output thresholds along.
    latency_warning_threshold: int = 2
    latency_critical_threshold: int = 4
    safe_mode_recovery_steps: int = 5
    default_seed: int = 42
    # When True (default since PR 1.3), the orchestrator routes the
    # controller-facing sensor feed through the INS+GPS+EKF
    # NavigationPipeline (see ADR 0010). Flip to False to fall back
    # to the legacy direct-`SensorModel` feed — that mode remains
    # supported for the unit-test baseline that pins `SensorModel`
    # behaviour directly, but it is a second-class path going forward.
    navigation_pipeline_enabled: bool = True


DEFAULT_CONFIG = SimulationConfig()
