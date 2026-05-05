"""YAML hostile-payload caps (Phase 8.1)."""

from __future__ import annotations

import pytest

from app.scenarios.loader import MAX_YAML_BYTES, MAX_YAML_DEPTH, parse_yaml

_BASE = """
name: shape
description: ""
expected_behavior: ""
seed: 1
steps: 5
"""


def test_oversize_payload_rejected():
    bloat = _BASE + "# " + ("x" * (MAX_YAML_BYTES + 1)) + "\n"
    with pytest.raises(ValueError, match="exceeds"):
        parse_yaml(bloat)


def test_deeply_nested_payload_rejected():
    # Build a nested dict via flow-style {} so the YAML payload stays
    # compact and easy to assemble.
    nested = "v"
    for _ in range(MAX_YAML_DEPTH + 2):
        nested = "{ k: " + str(nested) + " }"
    bad = _BASE + "extra: " + nested + "\n"
    with pytest.raises(ValueError, match="nesting depth"):
        parse_yaml(bad)


def test_caps_match_documented_values():
    assert MAX_YAML_BYTES == 64 * 1024
    assert MAX_YAML_DEPTH == 12
