"""Fault metadata DSL (Phase 5.5).

A fault's metadata field can be either:

- A plain scalar (number, string, bool, list).
- A small mapping describing a time-varying value:
    ``{"ramp": [from, to, steps]}`` — linear ramp from ``from`` to
    ``to`` over ``steps`` simulation steps. Beyond ``steps`` the
    value is clamped at ``to``.

``resolve(value, step_offset)`` collapses the value to a plain
scalar at a given step offset (steps since the fault started). The
helper is the single place that interprets DSL terms; sensor and
controller fault application call it instead of unwrapping
metadata directly.
"""

from __future__ import annotations

from typing import Any


def is_dsl(value: Any) -> bool:
    return isinstance(value, dict) and "ramp" in value


def validate(value: Any) -> None:
    """Raise ValueError if ``value`` is a malformed DSL term.

    Plain scalars pass without validation. Used by the YAML loader
    so a malformed metadata blob fails registration rather than
    surfacing as a runtime KeyError mid-simulation.
    """

    if not is_dsl(value):
        return
    spec = value["ramp"]
    if not isinstance(spec, list) or len(spec) != 3:
        raise ValueError("ramp must be a 3-element list [from, to, steps]")
    start, end, steps = spec
    if not all(isinstance(x, (int, float)) for x in (start, end)):
        raise ValueError("ramp from/to must be numeric")
    if not isinstance(steps, int) or steps <= 0:
        raise ValueError("ramp steps must be a positive integer")


def resolve(value: Any, step_offset: int) -> Any:
    """Collapse a DSL value to a scalar at the given step offset.

    Returns the input unchanged when it is not a DSL term. The
    function is intentionally lenient: the validate() pass at
    registration is responsible for rejecting malformed terms, so
    runtime can assume a sane shape.
    """

    if not is_dsl(value):
        return value
    spec = value["ramp"]
    start, end, steps = spec
    if step_offset <= 0:
        return start
    if step_offset >= steps:
        return end
    fraction = step_offset / steps
    return start + (end - start) * fraction


def validate_metadata(metadata: dict) -> None:
    """Validate every value in a metadata dict. Use at registration."""

    for v in metadata.values():
        validate(v)


def resolve_metadata(metadata: dict, step_offset: int) -> dict:
    """Return a metadata dict with all DSL terms collapsed."""

    return {k: resolve(v, step_offset) for k, v in metadata.items()}
