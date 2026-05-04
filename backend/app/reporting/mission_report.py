from typing import Dict

from ..persistence.repository import SimulationRepository
from . import risk, summary


def build_report(repo: SimulationRepository, simulation_id: str) -> Dict:
    sim = repo.get_simulation(simulation_id)
    if sim is None:
        raise ValueError(f"simulation '{simulation_id}' not found")

    states = repo.get_step_records(simulation_id)
    sensors = repo.get_sensor_readings(simulation_id)
    outputs = repo.get_controller_outputs(simulation_id)
    votes = repo.get_votes(simulation_id)
    decisions = repo.get_decisions(simulation_id)
    faults = repo.get_faults(simulation_id)
    events = repo.get_events(simulation_id)

    initial_state = states[0] if states else None
    final_state = states[-1] if states else None
    final_mode = decisions[-1]["system_mode"] if decisions else "NORMAL"

    report = {
        "simulation_id": simulation_id,
        "seed": sim["seed"],
        "total_steps": len(decisions),
        "initial_state": initial_state,
        "final_state": final_state,
        "final_system_mode": final_mode,
        "injected_faults": faults,
        "mode_transitions": summary.mode_transition_timeline(decisions),
        "controller_trust_summary": summary.controller_trust_summary(outputs),
        "sensor_health_summary": summary.sensor_health_summary(sensors),
        "vote_outcome_counts": summary.vote_outcome_counts(votes),
        "rejected_controller_counts": summary.rejected_controller_counts(votes),
        "critical_events": summary.critical_events(events),
        "risk_assessment": risk.assess_risk(decisions, faults, events),
        "deterministic_reproducibility": {
            "note": "The same seed plus the same fault schedule reproduces the timeline.",
            "seed": sim["seed"],
        },
    }
    return report


def render_markdown(report: Dict) -> str:
    lines = []
    lines.append(f"# SentinelNav Mission Report")
    lines.append("")
    lines.append(f"- **Simulation ID:** `{report['simulation_id']}`")
    lines.append(f"- **Seed:** `{report['seed']}`")
    lines.append(f"- **Total steps:** {report['total_steps']}")
    lines.append(f"- **Final system mode:** `{report['final_system_mode']}`")

    risk_a = report["risk_assessment"]
    lines.append(f"- **Risk level:** `{risk_a['level']}` — {risk_a['summary']}")
    lines.append("")

    lines.append("## Initial state")
    lines.append("```")
    lines.append(_kv_block(report.get("initial_state") or {}))
    lines.append("```")
    lines.append("")

    lines.append("## Final state")
    lines.append("```")
    lines.append(_kv_block(report.get("final_state") or {}))
    lines.append("```")
    lines.append("")

    lines.append("## Mode transitions")
    if not report["mode_transitions"]:
        lines.append("_No transitions recorded._")
    for t in report["mode_transitions"]:
        lines.append(f"- step {t['step']}: **{t['mode']}** — {t.get('justification', '')}")
    lines.append("")

    lines.append("## Injected faults")
    if not report["injected_faults"]:
        lines.append("_None._")
    for f in report["injected_faults"]:
        lines.append(
            f"- `{f['type']}` on `{f['target_component']}` "
            f"(steps {f['start_step']}–{f.get('end_step')}, severity {f['severity']})"
        )
    lines.append("")

    lines.append("## Controller trust summary")
    for cid, t in report["controller_trust_summary"].items():
        lines.append(f"- **{cid}** — valid_rate {t['valid_rate']}, avg_response_ms {t['avg_response_ms']}, actions {t['actions']}")
    lines.append("")

    sh = report["sensor_health_summary"]
    lines.append("## Sensor health summary")
    lines.append(
        f"- steps {sh.get('steps', 0)}, invalid {sh.get('invalid', 0)}, "
        f"avg_confidence {sh.get('avg_confidence', 0.0)}, invalid_rate {sh.get('invalid_rate', 0.0)}"
    )
    lines.append("")

    lines.append("## Vote outcomes")
    for outcome, count in report["vote_outcome_counts"].items():
        lines.append(f"- {outcome}: {count}")
    lines.append("")

    lines.append("## Rejected-controller counts")
    if not report["rejected_controller_counts"]:
        lines.append("_None._")
    for cid, count in report["rejected_controller_counts"].items():
        lines.append(f"- {cid}: {count}")
    lines.append("")

    lines.append("## Critical events")
    if not report["critical_events"]:
        lines.append("_None recorded._")
    for e in report["critical_events"][:50]:
        lines.append(f"- step {e['step']} `{e['component']}` `{e['type']}` — {e['message']}")
    lines.append("")

    lines.append("## Reproducibility")
    lines.append(report["deterministic_reproducibility"]["note"])
    return "\n".join(lines)


def _kv_block(d: dict) -> str:
    lines = []
    for k, v in d.items():
        lines.append(f"{k}: {v}")
    return "\n".join(lines)
