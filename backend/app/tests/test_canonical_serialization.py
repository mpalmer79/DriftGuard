"""Unit tests for canonical replay serialization (Phase 10).

End-to-end fingerprint stability is covered in test_replay_fingerprint;
these tests pin the lower-level scrubbing rules so the canonicalization
contract stays explicit.
"""

from dataclasses import dataclass

from app.core.canonical import canonical_json, fingerprint, step_record_to_dict
from app.domain.enums import Action, SystemMode


@dataclass
class _Toy:
    event_id: str
    reading_id: str
    simulation_id: str
    step: int
    altitude: float


def test_nondeterministic_fields_are_stripped():
    record = _Toy("ev-1", "rd-1", "sim-1", 0, 1000.123456789)
    out = step_record_to_dict(record)
    assert "event_id" not in out
    assert "reading_id" not in out
    assert "simulation_id" not in out
    assert out["step"] == 0


def test_floats_are_rounded_for_stability():
    record = _Toy("e", "r", "s", 0, 1.0000000004)
    out = step_record_to_dict(record)
    # 9-digit precision -> 1.0 once rounded.
    assert out["altitude"] == round(1.0000000004, 9)


def test_canonical_json_is_sorted():
    a = {"event_id": "x", "step": 1, "altitude": 1.0, "velocity": 2.0}
    b = {"event_id": "y", "step": 2, "altitude": 1.0, "velocity": 2.0}
    payload = canonical_json([a, b])
    # sort_keys: altitude before step before velocity within each record.
    assert payload.index("altitude") < payload.index("step")
    assert payload.index("step") < payload.index("velocity")


def test_two_runs_with_different_ids_share_fingerprint():
    a = [{"event_id": "ev-A", "simulation_id": "s1", "step": 0, "value": 1.0}]
    b = [{"event_id": "ev-B", "simulation_id": "s2", "step": 0, "value": 1.0}]
    assert fingerprint(a) == fingerprint(b)


def test_different_payloads_differ():
    a = [{"step": 0, "value": 1.0}]
    b = [{"step": 0, "value": 2.0}]
    assert fingerprint(a) != fingerprint(b)


def test_enums_serialize_to_their_value():
    record = {"step": 0, "system_mode": SystemMode.SAFE_MODE, "action": Action.ABORT}
    payload = canonical_json([record])
    assert "SAFE_MODE" in payload
    assert "ABORT" in payload


def test_nested_structures_are_scrubbed():
    record = {
        "step": 0,
        "events": [
            {"event_id": "drop-me", "type": "FAULT"},
            {"event_id": "drop-me-too", "type": "VOTE"},
        ],
    }
    out = step_record_to_dict(record)
    assert "event_id" not in out["events"][0]
    assert out["events"][0]["type"] == "FAULT"


def test_fingerprint_is_64_char_hex():
    digest = fingerprint([{"step": 0}])
    assert len(digest) == 64
    int(digest, 16)  # raises if non-hex
