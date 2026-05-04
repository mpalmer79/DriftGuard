import uuid


def new_id(prefix: str | None = None) -> str:
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
