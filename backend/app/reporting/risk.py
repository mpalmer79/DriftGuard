def assess_risk(decisions: list[dict], faults: list[dict], events: list[dict]) -> dict[str, str]:
    if not decisions:
        return {"level": "UNKNOWN", "summary": "no decisions recorded"}

    final = decisions[-1]
    mode = final["system_mode"]

    critical_events = [e for e in events if e.get("severity") == "CRITICAL"]
    failed_steps = [d for d in decisions if d["system_mode"] == "FAILED"]
    safe_steps = [d for d in decisions if d["system_mode"] == "SAFE_MODE"]

    if mode == "FAILED" or len(failed_steps) > 0:
        level = "HIGH"
        summary = (
            f"system entered FAILED on {len(failed_steps)} step(s); manual intervention required"
        )
    elif mode == "SAFE_MODE" or len(safe_steps) >= max(3, len(decisions) // 4):
        level = "ELEVATED"
        summary = f"safe-mode dwell of {len(safe_steps)} step(s) indicates loss of trust"
    elif critical_events:
        level = "MODERATE"
        summary = f"{len(critical_events)} critical events without entering FAILED"
    elif faults:
        level = "LOW"
        summary = f"faults present but contained; mode finished at {mode}"
    else:
        level = "NOMINAL"
        summary = "no faults observed; system held NORMAL throughout"

    return {"level": level, "summary": summary}
