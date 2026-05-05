"""Isolation-forest anomaly detector tests (Phase 6.1)."""

import pytest

from app.core.rng import RngService
from app.simulation.anomaly import IsolationForest, features_from_step


def _normal_rows(n: int = 64, rng=None) -> list[list[float]]:
    rng = rng or RngService(seed=1).child("anomaly.train")
    return [[rng.gauss(0.0, 1.0) for _ in range(4)] for _ in range(n)]


def test_fit_requires_data():
    forest = IsolationForest(rng=RngService(seed=1).child("anomaly"))
    with pytest.raises(ValueError):
        forest.fit([])


def test_fit_rejects_ragged_rows():
    forest = IsolationForest(rng=RngService(seed=1).child("anomaly"))
    with pytest.raises(ValueError):
        forest.fit([[1.0, 2.0], [1.0, 2.0, 3.0]])


def test_score_before_fit_raises():
    forest = IsolationForest(rng=RngService(seed=1).child("anomaly"))
    with pytest.raises(RuntimeError):
        forest.score([1.0, 2.0])


def test_score_returns_value_in_unit_interval():
    forest = IsolationForest(rng=RngService(seed=2).child("anomaly"))
    forest.fit(_normal_rows(64))
    s = forest.score([0.0, 0.0, 0.0, 0.0])
    assert 0.0 <= s <= 1.0


def test_outlier_scores_higher_than_inlier():
    """Far-from-the-mean points must score above well-centered ones."""

    forest = IsolationForest(rng=RngService(seed=3).child("anomaly"))
    forest.fit(_normal_rows(64))
    inlier = forest.score([0.0, 0.0, 0.0, 0.0])
    outlier = forest.score([100.0, 100.0, 100.0, 100.0])
    assert outlier > inlier


def test_two_forests_with_same_seed_produce_identical_scores():
    """Bit-identical scores under the RngService — central determinism
    claim of ADR 0006 still holds for ML signals."""

    rows = _normal_rows(64, RngService(seed=10).child("data"))
    a_rng = RngService(seed=10).child("anomaly")
    b_rng = RngService(seed=10).child("anomaly")
    a = IsolationForest(rng=a_rng)
    b = IsolationForest(rng=b_rng)
    a.fit(rows)
    b.fit(rows)
    points = [[i * 0.5, -i * 0.3, i, 1.0] for i in range(20)]
    assert [a.score(p) for p in points] == [b.score(p) for p in points]


def test_features_from_step_shape_is_stable():
    feats = features_from_step(
        sensor_altitude=1000.0,
        sensor_velocity=120.0,
        sensor_confidence=1.0,
        response_times_ms=[10.0, 12.0, 15.0],
        confidences=[0.8, 0.7, 0.9],
        valid_flags=[True, True, True],
    )
    assert len(feats) == 7
    assert feats[0] == 1000.0
    assert feats[1] == 120.0


def test_features_handle_empty_lists():
    feats = features_from_step(
        sensor_altitude=0.0,
        sensor_velocity=0.0,
        sensor_confidence=0.0,
        response_times_ms=[],
        confidences=[],
        valid_flags=[],
    )
    assert len(feats) == 7
    # Mean / max default to zero for empty inputs.
    assert feats[3] == 0.0
    assert feats[4] == 0.0
    assert feats[5] == 0.0
    assert feats[6] == 0.0


def test_features_count_invalid_controllers():
    feats = features_from_step(
        sensor_altitude=0.0,
        sensor_velocity=0.0,
        sensor_confidence=0.0,
        response_times_ms=[10.0, 20.0],
        confidences=[0.5, 0.5],
        valid_flags=[False, True],
    )
    # Last feature is invalid count.
    assert feats[-1] == 1.0
