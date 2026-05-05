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
    # Phase 2.1: opt-in continuous-time substep integrator
    # (simulation/dynamics/integrator.py). Default off — the legacy
    # discrete kinematic update in vehicle.apply_action stays the
    # canonical path because that is what the replay-fingerprint
    # contract pins. ADR 0007 + ADR 0010 document why we don't flip
    # this on by default.
    use_substep_integrator: bool = False
    integrator_substeps: int = 10
    # When True, the orchestrator routes the controller-facing sensor
    # feed through the INS+GPS+EKF NavigationPipeline. Default `False`
    # in PR 1.2 (the wiring lands; existing tests are untouched).
    # Flipped to True in PR 1.3 with explicit loosening on the
    # tolerances that change under EKF smoothing. See ADR 0010.
    navigation_pipeline_enabled: bool = False


DEFAULT_CONFIG = SimulationConfig()
