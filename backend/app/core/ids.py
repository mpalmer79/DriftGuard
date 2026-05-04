import uuid
from typing import Optional


def new_id(prefix: Optional[str] = None) -> str:
    base = uuid.uuid4().hex
    return f"{prefix}_{base}" if prefix else base


def simulation_id() -> str:
    return new_id("sim")


def event_id() -> str:
    return new_id("evt")


def fault_id() -> str:
    return new_id("flt")


def reading_id() -> str:
    return new_id("rd")
