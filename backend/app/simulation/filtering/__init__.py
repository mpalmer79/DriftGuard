"""State estimators that fuse multiple sensor channels.

The Phase 2.5 EKF fuses INS predictions (every step, drifting) with
GPS measurements (every 5 steps, bounded noise) into a position
estimate. RESEARCH.md §6.2 calls out estimator stacks as a v3
direction; this module is the minimum that delivers the acceptance
criterion ("converges to truth within 5 steps under nominal
conditions").

The estimator output never overrides the deterministic safe-mode
logic — controllers still consume the truth-sensor today, and the
realistic-mode switch in Phase 2.5 makes the EKF available as an
advisory channel only. Per the global rule about ML and advanced
estimators in the project directive, anything beyond this lives
outside the decision path.
"""

from .ekf import EKF, EKFEstimate

__all__ = ["EKF", "EKFEstimate"]
