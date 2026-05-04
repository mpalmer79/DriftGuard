import json
import time
from typing import List

from ..domain.events import Event
from ..domain.models import (
    ControllerOutput,
    FaultRecord,
    SensorReading,
    SystemDecision,
    VehicleState,
    VoteResult,
)
from ..simulation.orchestrator import Simulation, StepRecord
from .database import Database


class SimulationRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    def create_simulation(self, sim: Simulation) -> None:
        conn = self.db.connect()
        conn.execute(
            "INSERT OR REPLACE INTO simulations (id, seed, created_at) VALUES (?, ?, ?)",
            (sim.id, sim.seed, time.time()),
        )
        conn.commit()
        self._save_state(sim.id, sim.state)

    def save_step(self, simulation_id: str, record: StepRecord) -> None:
        conn = self.db.connect()
        self._save_state(simulation_id, record.state, conn=conn)
        self._save_sensor(simulation_id, record.sensor, conn=conn)
        for out in record.outputs:
            self._save_output(simulation_id, out, conn=conn)
        self._save_vote(simulation_id, record.state.step, record.vote, conn=conn)
        self._save_decision(simulation_id, record.decision, conn=conn)
        for ev in record.events:
            self._save_event(simulation_id, ev, conn=conn)
        conn.commit()

    def save_fault(self, simulation_id: str, fault: FaultRecord) -> None:
        conn = self.db.connect()
        conn.execute(
            """INSERT OR REPLACE INTO fault_records
            (simulation_id, fault_id, type, target_component, severity, active,
             start_step, end_step, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                simulation_id,
                fault.fault_id,
                fault.type.value,
                fault.target_component,
                fault.severity.value,
                int(fault.active),
                fault.start_step,
                fault.end_step,
                json.dumps(fault.metadata),
            ),
        )
        conn.commit()

    def list_events(self, simulation_id: str) -> List[dict]:
        conn = self.db.connect()
        rows = conn.execute(
            "SELECT * FROM events WHERE simulation_id = ? ORDER BY step ASC, event_id ASC",
            (simulation_id,),
        ).fetchall()
        return [self._event_row_to_dict(r) for r in rows]

    def get_latest_state(self, simulation_id: str) -> dict | None:
        conn = self.db.connect()
        row = conn.execute(
            "SELECT * FROM vehicle_state WHERE simulation_id = ? ORDER BY step DESC LIMIT 1",
            (simulation_id,),
        ).fetchone()
        return dict(row) if row else None

    def _save_state(self, sim_id: str, s: VehicleState, conn=None) -> None:
        c = conn or self.db.connect()
        c.execute(
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
        if conn is None:
            c.commit()

    def _save_sensor(self, sim_id: str, r: SensorReading, conn) -> None:
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

    def _save_output(self, sim_id: str, o: ControllerOutput, conn) -> None:
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

    def _save_vote(self, sim_id: str, step: int, v: VoteResult, conn) -> None:
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

    def _save_decision(self, sim_id: str, d: SystemDecision, conn) -> None:
        conn.execute(
            """INSERT OR REPLACE INTO system_decisions
            (simulation_id, step, final_action, system_mode, safe_mode_active,
             justification, trusted, rejected)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                sim_id,
                d.step,
                d.final_action.value,
                d.system_mode.value,
                int(d.safe_mode_active),
                d.justification,
                json.dumps(d.trusted_controllers),
                json.dumps(d.rejected_controllers),
            ),
        )

    def _save_event(self, sim_id: str, e: Event, conn) -> None:
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

    @staticmethod
    def _event_row_to_dict(row) -> dict:
        d = dict(row)
        d["metadata"] = json.loads(d["metadata"])
        return d
