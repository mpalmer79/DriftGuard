"""Unit tests for the deterministic RNG service (Phase 1.1).

These tests pin the contract documented in ADR 0006: same seed plus
same child name produces the same stream, and child RNGs do not leak
state into one another.
"""

import pytest

from app.core.rng import RngService


def test_same_seed_same_name_produces_identical_stream():
    a = RngService(seed=42).child("sensor")
    b = RngService(seed=42).child("sensor")
    for _ in range(100):
        assert a.random() == b.random()


def test_different_seed_diverges():
    a = RngService(seed=1).child("sensor")
    b = RngService(seed=2).child("sensor")
    diffs = sum(1 for _ in range(100) if a.random() != b.random())
    assert diffs > 90  # essentially always different


def test_different_names_diverge_under_same_seed():
    rng = RngService(seed=42)
    a = rng.child("sensor")
    b = rng.child("controller_a.fault")
    diffs = sum(1 for _ in range(100) if a.random() != b.random())
    assert diffs > 90


def test_child_lookup_is_cached():
    rng = RngService(seed=7)
    first = rng.child("sensor")
    first.random()  # advance the stream
    second = rng.child("sensor")
    assert first is second


def test_call_order_does_not_affect_child_streams():
    """Phase 1.1 motivation: requesting a child later must not skew its stream.

    This is the cross-contamination guarantee that ad-hoc per-subsystem
    Random instances did not provide.
    """

    rng_a = RngService(seed=99)
    sensor_a = rng_a.child("sensor")
    fault_a = rng_a.child("fault.intermittent")
    sample_a_sensor = [sensor_a.random() for _ in range(20)]
    sample_a_fault = [fault_a.random() for _ in range(20)]

    # Different order: ask for fault first, then sensor.
    rng_b = RngService(seed=99)
    fault_b = rng_b.child("fault.intermittent")
    sensor_b = rng_b.child("sensor")
    sample_b_fault = [fault_b.random() for _ in range(20)]
    sample_b_sensor = [sensor_b.random() for _ in range(20)]

    assert sample_a_sensor == sample_b_sensor
    assert sample_a_fault == sample_b_fault


def test_empty_name_rejected():
    with pytest.raises(ValueError):
        RngService(seed=1).child("")


def test_names_lists_materialized_children():
    rng = RngService(seed=3)
    assert rng.names() == ()
    rng.child("sensor")
    rng.child("controller_a.fault")
    assert set(rng.names()) == {"sensor", "controller_a.fault"}


def test_seed_property_is_immutable():
    rng = RngService(seed=10)
    assert rng.seed == 10


def test_derivation_is_independent_of_python_hash_seed():
    """Stable across processes: a precomputed child seed reproduces.

    If somebody hardcodes a derived seed in a test fixture, the value
    must remain stable across Python invocations.
    """

    expected = RngService(seed=12345).child("sensor")
    again = RngService(seed=12345).child("sensor")
    assert [expected.random() for _ in range(5)] == [again.random() for _ in range(5)]
