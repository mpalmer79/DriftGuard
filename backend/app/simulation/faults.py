import uuid
from typing import Dict, List, Optional

from ..domain.enums import FaultSeverity, FaultType
from ..domain.models import FaultRecord


class FaultRegistry:
    def __init__(self) -> None:
        self._faults: Dict[str, FaultRecord] = {}

    def inject(
        self,
        fault_type: FaultType,
        target: str,
        start_step: int,
        duration: Optional[int] = None,
        severity: FaultSeverity = FaultSeverity.WARNING,
        metadata: Optional[Dict] = None,
    ) -> FaultRecord:
        fault_id = str(uuid.uuid4())
        end_step = start_step + duration if duration is not None else None
        record = FaultRecord(
            fault_id=fault_id,
            type=fault_type,
            target_component=target,
            severity=severity,
            active=True,
            start_step=start_step,
            end_step=end_step,
            metadata=metadata or {},
        )
        self._faults[fault_id] = record
        return record

    def active_at(self, step: int) -> List[FaultRecord]:
        active: List[FaultRecord] = []
        for f in self._faults.values():
            if f.start_step > step:
                continue
            if f.end_step is not None and step >= f.end_step:
                f.active = False
                continue
            f.active = True
            active.append(f)
        return active

    def all(self) -> List[FaultRecord]:
        return list(self._faults.values())
