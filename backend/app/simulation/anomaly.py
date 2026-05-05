"""Isolation-forest anomaly detector (Phase 6).

Dependency-free. After ``fit``, ``score`` returns a value in
[0, 1] combining the standard isolation-forest path-length
signal with a range-deviation bonus for features outside the
warm-up envelope (so zero-variance features still surface).

ADR 0009 is the firewall: decision-path modules cannot import
this module, and this module never imports them.

Determinism: the RNG is supplied by the caller (per ADR 0006).
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
        self._mean: list[float] = []
        self._std: list[float] = []
        self._mins: list[float] = []
        self._maxs: list[float] = []

    @property
    def fitted(self) -> bool:
        return self._fitted

    def fit(self, rows: list[list[float]]) -> None:
        if not rows:
            raise ValueError("IsolationForest.fit requires at least one row")
        n_features = len(rows[0])
        if any(len(r) != n_features for r in rows):
            raise ValueError("IsolationForest.fit rows must be the same length")
        # Standardize per-feature so heterogeneous magnitudes
        # (altitude ~1000 vs invalid count ~3) do not dominate the
        # random splits of the isolation forest.
        self._mean, self._std = _column_stats(rows)
        self._mins = [min(r[i] for r in rows) for i in range(n_features)]
        self._maxs = [max(r[i] for r in rows) for i in range(n_features)]
        normalized = [_standardize(r, self._mean, self._std) for r in rows]
        self._trees = []
        for _ in range(self.n_trees):
            sample = _sample_with_replacement(normalized, self.sample_size, self._rng)
            self._trees.append(_build_tree(sample, self._rng, 0, self.max_depth))
        self._fitted = True

    def score(self, x: list[float]) -> float:
        """Anomaly score in [0, 1]. Higher = more anomalous.

        Combines the standard isolation-forest path-length score
        with a range-deviation bonus: features that fall outside
        the warm-up min/max envelope add to the score, since
        zero-variance features otherwise collapse to leaves and
        the forest cannot detect their deviation. The bonus is
        capped so a single out-of-range feature cannot saturate
        the score — multiple corroborating features still matter.
        """

        if not self._fitted:
            raise RuntimeError("IsolationForest.score called before fit")
        x_norm = _standardize(x, self._mean, self._std)
        avg_path = sum(_path_length(t, x_norm) for t in self._trees) / len(self._trees)
        c = _c_factor(self.sample_size)
        base = float(2.0 ** (-avg_path / c)) if c > 0.0 else 0.0
        bonus = _range_bonus(x, self._mins, self._maxs, self._std)
        return min(1.0, base + bonus)


def _sample_with_replacement(
    rows: list[list[float]], k: int, rng: random.Random
) -> list[list[float]]:
    if k >= len(rows):
        return list(rows)
    return [rng.choice(rows) for _ in range(k)]


def _column_stats(rows: list[list[float]]) -> tuple[list[float], list[float]]:
    n_cols = len(rows[0])
    n = len(rows)
    means = [sum(r[i] for r in rows) / n for i in range(n_cols)]
    stds = []
    for i in range(n_cols):
        var = sum((r[i] - means[i]) ** 2 for r in rows) / max(1, n - 1)
        # Floor at a tiny positive number so identical-column features
        # do not blow up the standardize call.
        stds.append(max(math.sqrt(var), 1e-9))
    return means, stds


def _standardize(row: list[float], mean: list[float], std: list[float]) -> list[float]:
    return [(row[i] - mean[i]) / std[i] for i in range(len(row))]


def _range_bonus(
    row: list[float],
    mins: list[float],
    maxs: list[float],
    std: list[float],
    per_feature: float = 0.06,
    sigma_tolerance: float = 2.0,
) -> float:
    """Score bonus for features clearly outside the warm-up envelope.

    A feature is "out of range" only when it is more than
    ``sigma_tolerance`` standard deviations beyond min or max — a
    cushion so per-step noise on a low-variance feature does not
    register as anomalous. Capped at 0.4 so a single saturated
    feature cannot drive the score to 1.0 by itself.
    """

    out = 0
    for i, value in enumerate(row):
        tolerance = max(std[i] * sigma_tolerance, 1e-9)
        if value < mins[i] - tolerance or value > maxs[i] + tolerance:
            out += 1
    return min(0.4, out * per_feature)


# features_from_step lives in anomaly_sidecar.py — see that module.
# Keeping it here would push anomaly.py over the 200-line ceiling.
