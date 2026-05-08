"""Per-table INSERT helpers for the repository.

Each helper takes a sqlite Connection and the domain object to persist.
Extracted from `repository.py` so the read-API and write-API live
separately and the public class stays small.
"""

import json

from ..domain.events import Event
from ..domain.models import (
    ControllerOutput,
    SensorReading,
    SystemDecision,
    VehicleState,
    VoteResult,
)


def save_state(conn, sim_id: str, s: VehicleState) -> None:
    conn.execute(
        """INSERT OR REPLACE INTO vehicle_state
        (simulation_id, step, timestamp, position_x, position_y, altitude,
         velocity, heading, pitch, roll, system_mode, last_action)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            sim_id,
            s.step,
            s.timestamp,
            s.position_x,
            s.position_y,
            s.altitude,
            s.velocity,
            s.heading,
            s.pitch,
            s.roll,
            s.system_mode.value,
            s.last_action.value if s.last_action else None,
        ),
    )


def save_sensor(conn, sim_id: str, r: SensorReading) -> None:
    conn.execute(
        """INSERT OR REPLACE INTO sensor_readings
        (simulation_id, step, reading_id, altitude, velocity, heading,
         pitch, roll, confidence, status, fault_flags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            sim_id,
            r.step,
            r.reading_id,
            r.altitude,
            r.velocity,
            r.heading,
            r.pitch,
            r.roll,
            r.confidence,
            r.status.value,
            json.dumps(r.fault_flags),
        ),
    )


def save_output(conn, sim_id: str, o: ControllerOutput) -> None:
    conn.execute(
        """INSERT OR REPLACE INTO controller_outputs
        (simulation_id, step, controller_id, action, confidence,
         reason_code, response_time_ms, valid)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            sim_id,
            o.step,
            o.controller_id,
            o.action.value,
            o.confidence,
            o.reason_code,
            o.response_time_ms,
            int(o.valid),
        ),
    )


def save_vote(conn, sim_id: str, step: int, v: VoteResult) -> None:
    conn.execute(
        """INSERT OR REPLACE INTO vote_results
        (simulation_id, step, outcome, selected_action, agreeing, rejected, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            sim_id,
            step,
            v.outcome.value,
            v.selected_action.value if v.selected_action else None,
            json.dumps(v.agreeing_controllers),
            json.dumps(v.rejected_controllers),
            v.reason,
        ),
    )


def save_decision(conn, sim_id: str, d: SystemDecision) -> None:
    causality_payload = {
        "previous_mode": d.previous_mode.value,
        "trigger_reason": d.trigger_reason,
        "active_fault_ids": list(d.active_fault_ids),
        "detector_findings": list(d.detector_findings),
        "vote_split": dict(d.vote_split),
    }
    conn.execute(
        """INSERT OR REPLACE INTO system_decisions
        (simulation_id, step, final_action, system_mode, safe_mode_active,
         justification, trusted, rejected, causality_payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            sim_id,
            d.step,
            d.final_action.value,
            d.system_mode.value,
            int(d.safe_mode_active),
            d.justification,
            json.dumps(d.trusted_controllers),
            json.dumps(d.rejected_controllers),
            json.dumps(causality_payload),
        ),
    )


def save_trust_snapshot(conn, sim_id: str, step: int, payload: dict) -> None:
    conn.execute(
        """INSERT OR REPLACE INTO trust_snapshots
        (simulation_id, step, payload) VALUES (?, ?, ?)""",
        (sim_id, step, json.dumps(payload, sort_keys=True)),
    )


def save_event(conn, sim_id: str, e: Event) -> None:
    conn.execute(
        """INSERT OR IGNORE INTO events
        (event_id, simulation_id, step, timestamp, component, type,
         severity, message, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            e.event_id,
            sim_id,
            e.step,
            e.timestamp,
            e.component,
            e.type.value,
            e.severity.value,
            e.message,
            json.dumps(e.metadata),
        ),
    )
