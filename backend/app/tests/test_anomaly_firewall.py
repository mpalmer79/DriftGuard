"""ADR 0009 firewall test (Phase 6.4).

The anomaly detector is advisory only. Decision-path modules
(safe_mode, voting, the counter / trust detectors) are forbidden
from importing it, because that's how the firewall stays the
firewall. We assert the constraint by walking the AST of each
listed source file: any direct or relative import of
``app.simulation.anomaly`` or ``app.simulation.anomaly_sidecar``
fails the test.

This is a test of the IMPORT GRAPH, not just runtime behavior. A
contributor who edits one of the listed files to import anomaly
gets a failing test pointing at the ADR before review picks it up.
"""

from __future__ import annotations

import ast
import pathlib

# Modules whose decisions must not depend on the anomaly score.
DECISION_PATH_FILES = [
    "app/simulation/safe_mode.py",
    "app/simulation/voting.py",
    "app/simulation/detection.py",  # counter-based detector
    "app/simulation/health.py",  # trust detector
]

FORBIDDEN_NAMES = ("anomaly", "anomaly_sidecar")


def _backend_root() -> pathlib.Path:
    return pathlib.Path(__file__).parent.parent.parent


def _imports_in(path: pathlib.Path) -> list[str]:
    tree = ast.parse(path.read_text())
    names: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                names.append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            names.append(module)
            for alias in node.names:
                names.append(f"{module}.{alias.name}" if module else alias.name)
    return names


def test_decision_path_modules_do_not_import_anomaly():
    root = _backend_root()
    offenders: list[str] = []
    for rel in DECISION_PATH_FILES:
        path = root / rel
        assert path.exists(), f"{rel} missing — adjust the firewall list"
        for imported in _imports_in(path):
            for forbidden in FORBIDDEN_NAMES:
                if forbidden in imported.split("."):
                    offenders.append(f"{rel} imports {imported}")
    assert not offenders, (
        "ADR 0009 firewall violated:\n  "
        + "\n  ".join(offenders)
        + "\nThe anomaly detector is advisory only; decision-path modules "
        "must not import it."
    )


def test_anomaly_module_does_not_import_decision_path():
    """Symmetric check: the anomaly module must not depend on the
    decision path either, so a future refactor that swaps the
    algorithm cannot accidentally pull a decision-path symbol."""

    root = _backend_root()
    forbidden_imports = {"safe_mode", "voting", "detection", "health"}
    offenders: list[str] = []
    for rel in ("app/simulation/anomaly.py", "app/simulation/anomaly_sidecar.py"):
        path = root / rel
        assert path.exists()
        for imported in _imports_in(path):
            parts = imported.split(".")
            if any(p in forbidden_imports for p in parts):
                offenders.append(f"{rel} imports {imported}")
    assert not offenders, "anomaly module reached into the decision path: " + ", ".join(offenders)
