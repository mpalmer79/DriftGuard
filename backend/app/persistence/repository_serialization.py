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
