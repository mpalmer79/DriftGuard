import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS simulations (
    id TEXT PRIMARY KEY,
    seed INTEGER NOT NULL,
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicle_state (
    simulation_id TEXT NOT NULL,
    step INTEGER NOT NULL,
    timestamp REAL NOT NULL,
    position_x REAL NOT NULL,
    position_y REAL NOT NULL,
    altitude REAL NOT NULL,
    velocity REAL NOT NULL,
    heading REAL NOT NULL,
    pitch REAL NOT NULL,
    roll REAL NOT NULL,
    system_mode TEXT NOT NULL,
    last_action TEXT,
    PRIMARY KEY (simulation_id, step)
);

CREATE TABLE IF NOT EXISTS sensor_readings (
    simulation_id TEXT NOT NULL,
    step INTEGER NOT NULL,
    reading_id TEXT NOT NULL,
    altitude REAL NOT NULL,
    velocity REAL NOT NULL,
    heading REAL NOT NULL,
    pitch REAL NOT NULL,
    roll REAL NOT NULL,
    confidence REAL NOT NULL,
    status TEXT NOT NULL,
    fault_flags TEXT NOT NULL,
    PRIMARY KEY (simulation_id, step)
);

CREATE TABLE IF NOT EXISTS controller_outputs (
    simulation_id TEXT NOT NULL,
    step INTEGER NOT NULL,
    controller_id TEXT NOT NULL,
    action TEXT NOT NULL,
    confidence REAL NOT NULL,
    reason_code TEXT NOT NULL,
    response_time_ms REAL NOT NULL,
    valid INTEGER NOT NULL,
    PRIMARY KEY (simulation_id, step, controller_id)
);

CREATE TABLE IF NOT EXISTS vote_results (
    simulation_id TEXT NOT NULL,
    step INTEGER NOT NULL,
    outcome TEXT NOT NULL,
    selected_action TEXT,
    agreeing TEXT NOT NULL,
    rejected TEXT NOT NULL,
    reason TEXT NOT NULL,
    PRIMARY KEY (simulation_id, step)
);

CREATE TABLE IF NOT EXISTS fault_records (
    simulation_id TEXT NOT NULL,
    fault_id TEXT NOT NULL,
    type TEXT NOT NULL,
    target_component TEXT NOT NULL,
    severity TEXT NOT NULL,
    active INTEGER NOT NULL,
    start_step INTEGER NOT NULL,
    end_step INTEGER,
    metadata TEXT NOT NULL,
    PRIMARY KEY (simulation_id, fault_id)
);

CREATE TABLE IF NOT EXISTS system_decisions (
    simulation_id TEXT NOT NULL,
    step INTEGER NOT NULL,
    final_action TEXT NOT NULL,
    system_mode TEXT NOT NULL,
    safe_mode_active INTEGER NOT NULL,
    justification TEXT NOT NULL,
    trusted TEXT NOT NULL,
    rejected TEXT NOT NULL,
    causality_payload TEXT,
    PRIMARY KEY (simulation_id, step)
);

CREATE TABLE IF NOT EXISTS events (
    event_id TEXT PRIMARY KEY,
    simulation_id TEXT NOT NULL,
    step INTEGER NOT NULL,
    timestamp REAL NOT NULL,
    component TEXT NOT NULL,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_sim_step ON events(simulation_id, step);

-- Per-step TrustDetector snapshot. Payload is the JSON-encoded output
-- of TrustDetector.snapshot(); kept separate from timeline tables so
-- it can be added or dropped without touching the replay fingerprint.
CREATE TABLE IF NOT EXISTS trust_snapshots (
    simulation_id TEXT NOT NULL,
    step INTEGER NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY (simulation_id, step)
);
"""


class Database:
    def __init__(self, path: str = ":memory:") -> None:
        self.path = path
        self._conn: sqlite3.Connection | None = None

    def connect(self) -> sqlite3.Connection:
        if self._conn is None:
            if self.path != ":memory:":
                Path(self.path).parent.mkdir(parents=True, exist_ok=True)
            self._conn = sqlite3.connect(self.path, check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
            # WAL mode keeps reads from blocking writes (Phase 4.1).
            # `:memory:` is single-connection and ignores the PRAGMA.
            if self.path != ":memory:":
                self._conn.execute("PRAGMA journal_mode=WAL")
                self._conn.execute("PRAGMA synchronous=NORMAL")
            self._conn.executescript(SCHEMA)
            _apply_migrations(self._conn)
            self._conn.commit()
        return self._conn

    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None


def _apply_migrations(conn: sqlite3.Connection) -> None:
    """Idempotent ALTER TABLEs for columns added after the original schema.

    ``CREATE TABLE IF NOT EXISTS`` does not retro-add columns, so each
    migration runs separately and swallows the "duplicate column" error
    that means it already ran on this DB file.
    """

    _add_column_if_missing(conn, "system_decisions", "causality_payload", "TEXT")


def _add_column_if_missing(
    conn: sqlite3.Connection,
    table: str,
    column: str,
    column_type: str,
) -> None:
    try:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {column_type}")
    except sqlite3.OperationalError as exc:
        # "duplicate column" means we ran on this DB before; anything
        # else is a real schema problem.
        if "duplicate column" not in str(exc).lower():
            raise
