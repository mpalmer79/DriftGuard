from collections import Counter


def vote_outcome_counts(votes: list[dict]) -> dict[str, int]:
    return dict(Counter(v["outcome"] for v in votes))


def rejected_controller_counts(votes: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for v in votes:
        for cid in v.get("rejected", []):
            counts[cid] = counts.get(cid, 0) + 1
    return counts


def mode_transition_timeline(decisions: list[dict]) -> list[dict]:
    transitions: list[dict] = []
    prev = None
    for d in decisions:
        m = d["system_mode"]
        if m != prev:
            transitions.append(
                {"step": d["step"], "mode": m, "justification": d.get("justification", "")}
            )
            prev = m
    return transitions


def critical_events(events: list[dict]) -> list[dict]:
    return [e for e in events if e.get("severity") == "CRITICAL"]


def controller_trust_summary(outputs: list[dict]) -> dict[str, dict]:
    trust: dict[str, dict] = {}
    for o in outputs:
        cid = o["controller_id"]
        s = trust.setdefault(
            cid, {"steps": 0, "invalid": 0, "avg_response_ms": 0.0, "actions": Counter()}
        )
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


def sensor_health_summary(readings: list[dict]) -> dict:
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


def anomaly_vs_deterministic_summary(events: list[dict]) -> dict:
    """ML-vs-deterministic agreement signal (Phase 6.3).

    Compares the steps where the anomaly sidecar emitted WARNING or
    CRITICAL events against the steps where deterministic detectors
    (counter / trust / safe-mode) emitted non-INFO FAULT events. The
    intersection is the agreement count; report headlines like
    "ML agreed with the deterministic system on X of Y events" come
    out of this directly.
    """

    anomaly_steps: set[int] = set()
    deterministic_steps: set[int] = set()
    anomaly_scores: list[float] = []

    for event in events:
        component = event.get("component", "")
        severity = event.get("severity", "")
        if severity not in ("WARNING", "CRITICAL"):
            continue
        if component == "anomaly":
            anomaly_steps.add(event["step"])
            score = (event.get("metadata") or {}).get("score")
            if isinstance(score, (int, float)):
                anomaly_scores.append(float(score))
        elif event.get("type") == "FAULT":
            # Counter / trust / per-controller fault events.
            deterministic_steps.add(event["step"])
        elif event.get("type") == "MODE_CHANGE":
            deterministic_steps.add(event["step"])

    agreement = anomaly_steps & deterministic_steps
    only_anomaly = anomaly_steps - deterministic_steps
    only_deterministic = deterministic_steps - anomaly_steps

    union = anomaly_steps | deterministic_steps
    rate = round(len(agreement) / len(union), 3) if union else 0.0
    avg_score = round(sum(anomaly_scores) / len(anomaly_scores), 3) if anomaly_scores else 0.0

    return {
        "anomaly_alert_steps": sorted(anomaly_steps),
        "deterministic_alert_steps": sorted(deterministic_steps),
        "agreement_steps": sorted(agreement),
        "only_anomaly_steps": sorted(only_anomaly),
        "only_deterministic_steps": sorted(only_deterministic),
        "agreement_rate": rate,
        "average_anomaly_score": avg_score,
    }
