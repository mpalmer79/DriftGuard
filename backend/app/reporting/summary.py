from collections import Counter
from typing import Dict, List


def vote_outcome_counts(votes: List[dict]) -> Dict[str, int]:
    return dict(Counter(v["outcome"] for v in votes))


def rejected_controller_counts(votes: List[dict]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for v in votes:
        for cid in v.get("rejected", []):
            counts[cid] = counts.get(cid, 0) + 1
    return counts


def mode_transition_timeline(decisions: List[dict]) -> List[Dict]:
    transitions: List[Dict] = []
    prev = None
    for d in decisions:
        m = d["system_mode"]
        if m != prev:
            transitions.append({"step": d["step"], "mode": m, "justification": d.get("justification", "")})
            prev = m
    return transitions


def critical_events(events: List[dict]) -> List[dict]:
    return [e for e in events if e.get("severity") == "CRITICAL"]


def controller_trust_summary(outputs: List[dict]) -> Dict[str, Dict]:
    trust: Dict[str, Dict] = {}
    for o in outputs:
        cid = o["controller_id"]
        s = trust.setdefault(cid, {"steps": 0, "invalid": 0, "avg_response_ms": 0.0, "actions": Counter()})
        s["steps"] += 1
        if not o["valid"]:
            s["invalid"] += 1
        s["avg_response_ms"] += float(o["response_time_ms"])
        s["actions"][o["action"]] += 1
    for cid, s in trust.items():
        if s["steps"]:
            s["avg_response_ms"] = round(s["avg_response_ms"] / s["steps"], 2)
        s["actions"] = dict(s["actions"])
        s["valid_rate"] = round(1.0 - (s["invalid"] / s["steps"]), 3) if s["steps"] else 0.0
    return trust


def sensor_health_summary(readings: List[dict]) -> Dict:
    if not readings:
        return {"steps": 0, "invalid": 0, "avg_confidence": 0.0}
    invalid = sum(1 for r in readings if r["status"] == "INVALID")
    avg_conf = sum(r["confidence"] for r in readings) / len(readings)
    return {
        "steps": len(readings),
        "invalid": invalid,
        "avg_confidence": round(avg_conf, 3),
        "invalid_rate": round(invalid / len(readings), 3),
    }
