"""Isolation-forest anomaly detector (Phase 6).

A deliberately small, dependency-free implementation. After
``fit`` consumes ``warmup_size`` step feature vectors, ``score``
returns an anomaly score in [0, 1] for any subsequent vector.
Higher scores indicate the point sits in shorter average path
lengths across the trees, which is the isolation-forest signal
for "atypical."

ADR 0009 is the firewall: the score is observability only. This
module never imports the safe-mode manager, voting engine, or any
detector that does affect decisions, and it is forbidden to be
imported from those modules.

Determinism: the RNG is supplied by the caller (per ADR 0006). For
the same seed the same warm-up data produces the same forest, so
two simulations with the same seed produce the same per-step
scores byte-for-byte.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass


@dataclass
class _Node:
    feature: int = -1
    threshold: float = 0.0
    left: _Node | None = None
    right: _Node | None = None
    size: int = 1  # leaf size when feature == -1


def _build_tree(
    rows: list[list[float]],
    rng: random.Random,
    depth: int,
    max_depth: int,
) -> _Node:
    n = len(rows)
    if n <= 1 or depth >= max_depth:
        return _Node(size=max(n, 1))
    n_features = len(rows[0])
    feature = rng.randrange(n_features)
    column = [r[feature] for r in rows]
    lo, hi = min(column), max(column)
    if lo == hi:
        return _Node(size=n)
    threshold = rng.uniform(lo, hi)
    left_rows = [r for r in rows if r[feature] < threshold]
    right_rows = [r for r in rows if r[feature] >= threshold]
    if not left_rows or not right_rows:
        return _Node(size=n)
    return _Node(
        feature=feature,
        threshold=threshold,
        left=_build_tree(left_rows, rng, depth + 1, max_depth),
        right=_build_tree(right_rows, rng, depth + 1, max_depth),
    )


def _path_length(node: _Node, x: list[float], depth: int = 0) -> float:
    if node.feature < 0:
        # Adjustment term per the original Liu et al. (2008) paper:
        # accounts for the expected depth of an unbuilt subtree of
        # size n, capped to avoid log(0).
        if node.size <= 1:
            return float(depth)
        return depth + _c_factor(node.size)
    branch = node.left if x[node.feature] < node.threshold else node.right
    return _path_length(branch, x, depth + 1)


def _c_factor(n: int) -> float:
    if n <= 1:
        return 0.0
    return 2.0 * (math.log(n - 1) + 0.5772156649) - 2.0 * (n - 1) / n


class IsolationForest:
    """Anomaly detector with a fixed warm-up window.

    Parameters mirror the standard isolation forest (Liu, Ting,
    Zhou 2008). Smaller defaults than scikit-learn so cold start
    is cheap on the simulation's small step counts.
    """

    def __init__(
        self,
        rng: random.Random,
        n_trees: int = 32,
        sample_size: int = 32,
        max_depth: int | None = None,
    ) -> None:
        self._rng = rng
        self.n_trees = n_trees
        self.sample_size = sample_size
        self.max_depth = max_depth or max(1, int(math.ceil(math.log2(max(2, sample_size)))))
        self._trees: list[_Node] = []
        self._fitted = False

    @property
    def fitted(self) -> bool:
        return self._fitted

    def fit(self, rows: list[list[float]]) -> None:
        if not rows:
            raise ValueError("IsolationForest.fit requires at least one row")
        n_features = len(rows[0])
        if any(len(r) != n_features for r in rows):
            raise ValueError("IsolationForest.fit rows must be the same length")
        self._trees = []
        for _ in range(self.n_trees):
            sample = _sample_with_replacement(rows, self.sample_size, self._rng)
            self._trees.append(_build_tree(sample, self._rng, 0, self.max_depth))
        self._fitted = True

    def score(self, x: list[float]) -> float:
        """Anomaly score in [0, 1]. Higher = more anomalous."""

        if not self._fitted:
            raise RuntimeError("IsolationForest.score called before fit")
        avg_path = sum(_path_length(t, x) for t in self._trees) / len(self._trees)
        c = _c_factor(self.sample_size)
        if c <= 0.0:
            return 0.0
        return float(2.0 ** (-avg_path / c))


def _sample_with_replacement(
    rows: list[list[float]], k: int, rng: random.Random
) -> list[list[float]]:
    if k >= len(rows):
        return list(rows)
    return [rng.choice(rows) for _ in range(k)]


def features_from_step(
    sensor_altitude: float,
    sensor_velocity: float,
    sensor_confidence: float,
    response_times_ms: list[float],
    confidences: list[float],
    valid_flags: list[bool],
) -> list[float]:
    """Pack a step's salient signals into a fixed-size feature vector.

    Order is stable so warm-up rows and live rows match. Includes:

    - sensor_altitude, sensor_velocity, sensor_confidence
    - mean / max controller response time
    - mean controller confidence
    - count of invalid controller outputs
    """

    if response_times_ms:
        mean_rt = sum(response_times_ms) / len(response_times_ms)
        max_rt = max(response_times_ms)
    else:
        mean_rt = 0.0
        max_rt = 0.0
    mean_conf = sum(confidences) / len(confidences) if confidences else 0.0
    invalid = float(sum(1 for v in valid_flags if not v))
    return [
        sensor_altitude,
        sensor_velocity,
        sensor_confidence,
        mean_rt,
        max_rt,
        mean_conf,
        invalid,
    ]
