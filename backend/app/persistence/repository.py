import json

from ..core.time import Clock, SystemClock
from ..domain.models import FaultRecord
from ..simulation.orchestrator import Simulation, StepRecord
from .database import Database
from .repository_serialization import (
    decision_row,
    event_row_to_dict,
    fault_row,
    sensor_row,
    vote_row,
)
from .repository_writes import (
    save_decision,
    save_event,
    save_output,
    save_sensor,
    save_state,
    save_vote,
)


class SimulationRepository:
    def __init__(self, db: Database, clock: Clock | None = None) -> None:
        self.db = db
        self.clock: Clock = clock if clock is not None else SystemClock()

    def create_simulation(self, sim: Simulation) -> None:
        conn = self.db.connect()
        conn.execute(
            "INSERT OR REPLACE INTO simulations (id, seed, created_at) VALUES (?, ?, ?)",
            (sim.id, sim.seed, self.clock.now()),
        )
        save_state(conn, sim.id, sim.state)
        conn.commit()

    def save_step(self, simulation_id: str, record: StepRecord) -> None:
        conn = self.db.connect()
        save_state(conn, simulation_id, record.state)
        save_sensor(conn, simulation_id, record.sensor)
        for out in record.outputs:
            save_output(conn, simulation_id, out)
        save_vote(conn, simulation_id, record.state.step, record.vote)
        save_decision(conn, simulation_id, record.decision)
        for ev in record.events:
            save_event(conn, simulation_id, ev)
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

    def list_events(self, simulation_id: str) -> list[dict]:
        conn = self.db.connect()
        rows = conn.execute(
            "SELECT * FROM events WHERE simulation_id = ? ORDER BY step ASC, event_id ASC",
            (simulation_id,),
        ).fetchall()
        return [event_row_to_dict(r) for r in rows]

    def get_latest_state(self, simulation_id: str) -> dict | None:
        conn = self.db.connect()
        row = conn.execute(
            "SELECT * FROM vehicle_state WHERE simulation_id = ? ORDER BY step DESC LIMIT 1",
            (simulation_id,),
        ).fetchone()
        return dict(row) if row else None

    def list_simulations(self) -> list[dict]:
        conn = self.db.connect()
        rows = conn.execute("SELECT * FROM simulations ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]

    def get_simulation(self, simulation_id: str) -> dict | None:
        conn = self.db.connect()
        row = conn.execute("SELECT * FROM simulations WHERE id = ?", (simulation_id,)).fetchone()
        return dict(row) if row else None

    def get_step_records(self, simulation_id: str) -> list[dict]:
        conn = self.db.connect()
        rows = conn.execute(
            "SELECT * FROM vehicle_state WHERE simulation_id = ? ORDER BY step ASC",
            (simulation_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_faults(self, simulation_id: str) -> list[dict]:
        conn = self.db.connect()
        rows = conn.execute(
            "SELECT * FROM fault_records WHERE simulation_id = ? ORDER BY start_step ASC",
            (simulation_id,),
        ).fetchall()
        return [fault_row(r) for r in rows]

    def get_decisions(self, simulation_id: str) -> list[dict]:
        conn = self.db.connect()
        rows = conn.execute(
            "SELECT * FROM system_decisions WHERE simulation_id = ? ORDER BY step ASC",
            (simulation_id,),
        ).fetchall()
        return [decision_row(r) for r in rows]

    def get_sensor_readings(self, simulation_id: str) -> list[dict]:
        conn = self.db.connect()
        rows = conn.execute(
            "SELECT * FROM sensor_readings WHERE simulation_id = ? ORDER BY step ASC",
            (simulation_id,),
        ).fetchall()
        return [sensor_row(r) for r in rows]

    def get_controller_outputs(self, simulation_id: str) -> list[dict]:
        conn = self.db.connect()
        rows = conn.execute(
            "SELECT * FROM controller_outputs WHERE simulation_id = ? ORDER BY step ASC, controller_id ASC",
            (simulation_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_votes(self, simulation_id: str) -> list[dict]:
        conn = self.db.connect()
        rows = conn.execute(
            "SELECT * FROM vote_results WHERE simulation_id = ? ORDER BY step ASC",
            (simulation_id,),
        ).fetchall()
        return [vote_row(r) for r in rows]

    def get_events(self, simulation_id: str) -> list[dict]:
        return self.list_events(simulation_id)

    def get_timeline(self, simulation_id: str) -> list[dict]:
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
            timeline.append(
                {
                    "step": step,
                    "state": states.get(step),
                    "sensor": sensors.get(step),
                    "controllers": outputs_by_step.get(step, []),
                    "vote": votes.get(step),
                    "decision": decisions.get(step),
                    "events": events_by_step.get(step, []),
                }
            )
        return timeline
