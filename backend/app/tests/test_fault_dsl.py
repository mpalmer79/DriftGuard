"""Fault DSL tests (Phase 5.5)."""

import pytest

from app.core.fault_dsl import (
    is_dsl,
    resolve,
    resolve_metadata,
    validate,
    validate_metadata,
)


def test_plain_scalar_passes_through():
    assert resolve(5.0, step_offset=10) == 5.0
    assert resolve("HOLD", step_offset=10) == "HOLD"
    assert resolve(True, step_offset=10) is True


def test_ramp_at_zero_returns_start():
    assert resolve({"ramp": [0, 50, 20]}, step_offset=0) == 0


def test_ramp_at_full_steps_returns_end():
    assert resolve({"ramp": [0, 50, 20]}, step_offset=20) == 50


def test_ramp_clamps_after_full_steps():
    assert resolve({"ramp": [0, 50, 20]}, step_offset=99) == 50


def test_ramp_linear_interpolation():
    val = resolve({"ramp": [0, 100, 10]}, step_offset=5)
    assert val == 50.0


def test_ramp_with_negative_offset_returns_start():
    assert resolve({"ramp": [10, 20, 5]}, step_offset=-3) == 10


def test_validate_accepts_well_formed_ramp():
    validate({"ramp": [0, 50, 20]})  # no raise


def test_validate_rejects_wrong_arity():
    with pytest.raises(ValueError):
        validate({"ramp": [0, 50]})


def test_validate_rejects_non_numeric_endpoints():
    with pytest.raises(ValueError):
        validate({"ramp": ["a", 50, 20]})


def test_validate_rejects_non_positive_steps():
    with pytest.raises(ValueError):
        validate({"ramp": [0, 50, 0]})
    with pytest.raises(ValueError):
        validate({"ramp": [0, 50, -3]})


def test_validate_passes_plain_values():
    validate(42)
    validate("string")
    validate([1, 2, 3])


def test_validate_metadata_walks_all_values():
    validate_metadata({"x": 1, "y": {"ramp": [0, 1, 5]}})


def test_validate_metadata_surfaces_bad_term():
    with pytest.raises(ValueError):
        validate_metadata({"y": {"ramp": [0, 1]}})


def test_resolve_metadata_collapses_terms():
    out = resolve_metadata({"a": 7, "b": {"ramp": [0, 100, 10]}}, step_offset=5)
    assert out == {"a": 7, "b": 50.0}


def test_is_dsl_predicate():
    assert is_dsl({"ramp": [0, 1, 1]})
    assert not is_dsl({"magnitude": 5})
    assert not is_dsl(5)
    assert not is_dsl(None)
