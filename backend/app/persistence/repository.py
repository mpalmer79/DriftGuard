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

    def list_simulations(self) -> List[dict]:
        conn = self.db.connect()
        rows = conn.execute(
            "SELECT * FROM simulations ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]

    def get_simulation(self, simulation_id: str) -> dict | None:
        conn = self.db.connect()
        row = conn.execute(
            "SELECT * FROM simulations WHERE id = ?", (simulation_id,)
        ).fetchone()
        return dict(row) if row else None

    def get_step_records(self, simulation_id: str) -> List[dict]:
        conn = self.db.connect()
        rows = conn.execute(
            "SELECT * FROM vehicle_state WHERE simulation_id = ? ORDER BY step ASC",
            (simulation_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_faults(self, simulation_id: str) -> List[dict]:
        conn = self.db.connect()
        rows = conn.execute(
            "SELECT * FROM fault_records WHERE simulation_id = ? ORDER BY start_step ASC",
            (simulation_id,),
        ).fetchall()
        return [self._fault_row(r) for r in rows]

    def get_decisions(self, simulation_id: str) -> List[dict]:
        conn = self.db.connect()
        rows = conn.execute(
            "SELECT * FROM system_decisions WHERE simulation_id = ? ORDER BY step ASC",
            (simulation_id,),
        ).fetchall()
        return [self._decision_row(r) for r in rows]

    def get_sensor_readings(self, simulation_id: str) -> List[dict]:
        conn = self.db.connect()
        rows = conn.execute(
            "SELECT * FROM sensor_readings WHERE simulation_id = ? ORDER BY step ASC",
            (simulation_id,),
        ).fetchall()
        return [self._sensor_row(r) for r in rows]

    def get_controller_outputs(self, simulation_id: str) -> List[dict]:
        conn = self.db.connect()
        rows = conn.execute(
            "SELECT * FROM controller_outputs WHERE simulation_id = ? ORDER BY step ASC, controller_id ASC",
            (simulation_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_votes(self, simulation_id: str) -> List[dict]:
        conn = self.db.connect()
        rows = conn.execute(
            "SELECT * FROM vote_results WHERE simulation_id = ? ORDER BY step ASC",
            (simulation_id,),
        ).fetchall()
        return [self._vote_row(r) for r in rows]

    def get_events(self, simulation_id: str) -> List[dict]:
        return self.list_events(simulation_id)

    def get_timeline(self, simulation_id: str) -> List[dict]:
        states = {s["step"]: s for s in self.get_step_records(simulation_id)}
        sensors = {s["step"]: s for s in self.get_sensor_readings(simulation_id)}
        decisions = {d["step"]: d for d in self.get_decisions(simulation_id)}
        votes = {v["step"]: v for v in self.get_votes(simulation_id)}
        outputs_by_step: dict[int, list] = {}
        for o in self.get_controller_outputs(simulation_id):
            outputs_by_step.setdefault(o["step"], []).append(o)
        events_by_step: dict[int, list] = {}
        for e in self.get_events(simulation_id):
            events_by_step.setdefault(e["step"], []).append(e)

        # A timeline entry only exists where a decision was made; the initial
        # pre-step state is excluded so each entry has a complete control-loop
        # snapshot.
        timeline = []
        for step in sorted(decisions):
            timeline.append({
                "step": step,
                "state": states.get(step),
                "sensor": sensors.get(step),
                "controllers": outputs_by_step.get(step, []),
                "vote": votes.get(step),
                "decision": decisions.get(step),
                "events": events_by_step.get(step, []),
            })
        return timeline

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

    @staticmethod
    def _fault_row(row) -> dict:
        d = dict(row)
        d["metadata"] = json.loads(d["metadata"])
        d["active"] = bool(d["active"])
        return d

    @staticmethod
    def _decision_row(row) -> dict:
        d = dict(row)
        d["trusted"] = json.loads(d["trusted"])
        d["rejected"] = json.loads(d["rejected"])
        d["safe_mode_active"] = bool(d["safe_mode_active"])
        return d

    @staticmethod
    def _sensor_row(row) -> dict:
        d = dict(row)
        d["fault_flags"] = json.loads(d["fault_flags"])
        return d

    @staticmethod
    def _vote_row(row) -> dict:
        d = dict(row)
        d["agreeing"] = json.loads(d["agreeing"])
        d["rejected"] = json.loads(d["rejected"])
        return d
