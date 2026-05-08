"""Canonical serialization for replay-equivalence checking.

Strips per-run UUIDs and other non-deterministic fields (see ADR 0004)
so two equivalent runs produce byte-identical output. The result is a
sorted-key, fixed-precision JSON string suitable for hashing.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict
from typing import Any

# Fields that legitimately differ between identical runs; stripped from
# canonical output so byte-equality is a meaningful claim.
#
# - event_id, reading_id: UUIDs; per ADR 0004 they exist to disambiguate
#   persisted rows, not to participate in reproducibility.
# - simulation_id: a UUID minted at simulation construction; equivalent
#   simulation timelines from two different sim_ids must compare equal
#   under canonicalization.
# - fault_id, active_fault_ids: per-run UUIDs minted by FaultRegistry. The
#   *count* and *target* of active faults are deterministic and remain in
#   canonical output via the fault row itself (target_component, type,
#   start_step, etc.); the identifier is not.
# - trust_snapshot: descriptive metadata produced by TrustDetector after
#   each step's update. It is fully deterministic given the seed but is
#   *redundant* with the rest of the canonical record (sensor, outputs,
#   vote → trust state). Including it would freeze the detector's
#   internal scoring constants into the fingerprint, so we keep the
#   fingerprint contract narrow and exclude it.
_NONDETERMINISTIC_FIELDS = frozenset(
    {
        "event_id",
        "reading_id",
        "simulation_id",
        "fault_id",
        "active_fault_ids",
        "trust_snapshot",
    }
)

# 9 digits is enough to distinguish the fault-injection magnitudes
# while absorbing IEEE-754 rounding noise.
_FLOAT_DIGITS = 9


def _scrub(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _scrub(v) for k, v in value.items() if k not in _NONDETERMINISTIC_FIELDS}
    if isinstance(value, list | tuple):
        return [_scrub(v) for v in value]
    if isinstance(value, float):
        return round(value, _FLOAT_DIGITS)
    return value


def step_record_to_dict(record: Any) -> dict:
    """Convert a StepRecord (or dict) to a canonical dict.

    Falls back to ``asdict`` when given a dataclass instance.
    """

    if hasattr(record, "__dataclass_fields__"):
        record = asdict(record)
    return _scrub(record)


def canonical_json(records: list[Any]) -> str:
    """Stable, sorted, fixed-precision JSON for a sequence of records."""

    payload = [step_record_to_dict(r) for r in records]
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=_default)


def fingerprint(records: list[Any]) -> str:
    """SHA-256 hex digest of the canonical timeline.

    The run hash referenced in RESEARCH.md §11–12. Two replays of the
    same scenario must agree on this byte-for-byte.
    """

    return hashlib.sha256(canonical_json(records).encode()).hexdigest()


def _default(obj: Any) -> Any:
    # Enums carry `.value`; fall back to repr so unexpected types make
    # the hash differ visibly rather than silently coercing.
    value = getattr(obj, "value", None)
    if value is not None:
        return value
    return repr(obj)
