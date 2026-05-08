"""Row -> dict helpers used by the repository read methods.

Sqlite stores the JSON-bearing fields as TEXT; these helpers parse
them back into Python objects and convert the integer flags to bool.
"""

import json


def event_row_to_dict(row) -> dict:
    d = dict(row)
    d["metadata"] = json.loads(d["metadata"])
    return d


def fault_row(row) -> dict:
    d = dict(row)
    d["metadata"] = json.loads(d["metadata"])
    d["active"] = bool(d["active"])
    return d


def decision_row(row) -> dict:
    d = dict(row)
    d["trusted"] = json.loads(d["trusted"])
    d["rejected"] = json.loads(d["rejected"])
    d["safe_mode_active"] = bool(d["safe_mode_active"])
    # causality_payload was added in a later migration; pre-migration
    # rows are NULL. Promote the blob to top-level keys with safe
    # defaults so callers don't have to defensively check.
    raw = d.pop("causality_payload", None)
    payload = json.loads(raw) if raw else {}
    d["previous_mode"] = payload.get("previous_mode", "NORMAL")
    # Legacy rows fall back to justification.
    d["trigger_reason"] = payload.get("trigger_reason") or d.get("justification", "")
    d["active_fault_ids"] = list(payload.get("active_fault_ids", []))
    d["detector_findings"] = list(payload.get("detector_findings", []))
    d["vote_split"] = dict(payload.get("vote_split", {}))
    return d


def sensor_row(row) -> dict:
    d = dict(row)
    d["fault_flags"] = json.loads(d["fault_flags"])
    return d


def vote_row(row) -> dict:
    d = dict(row)
    d["agreeing"] = json.loads(d["agreeing"])
    d["rejected"] = json.loads(d["rejected"])
    return d


def trust_snapshot_row(row) -> dict:
    d = dict(row)
    d["snapshot"] = json.loads(d.pop("payload"))
    return d
