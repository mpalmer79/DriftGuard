from collections import Counter

from ..domain.enums import VoteOutcome
from ..domain.models import ControllerOutput, VoteResult


def vote(outputs: list[ControllerOutput], latency_threshold_ms: float) -> VoteResult:
    rejected: list[str] = []
    candidates: list[ControllerOutput] = []

    for out in outputs:
        if not out.valid:
            rejected.append(out.controller_id)
            continue
        if out.response_time_ms > latency_threshold_ms:
            rejected.append(out.controller_id)
            continue
        candidates.append(out)

    if len(candidates) < 2:
        return VoteResult(
            outcome=VoteOutcome.INSUFFICIENT_DATA,
            selected_action=None,
            agreeing_controllers=[c.controller_id for c in candidates],
            rejected_controllers=rejected,
            reason="fewer than 2 valid controllers",
        )

    counts = Counter(c.action for c in candidates)
    top_action, top_count = counts.most_common(1)[0]

    if top_count >= 2:
        agreeing = [c.controller_id for c in candidates if c.action == top_action]
        not_agreeing = [c.controller_id for c in candidates if c.action != top_action]
        return VoteResult(
            outcome=VoteOutcome.CONSENSUS,
            selected_action=top_action,
            agreeing_controllers=agreeing,
            rejected_controllers=rejected + not_agreeing,
            reason=f"majority on {top_action.value}",
        )

    return VoteResult(
        outcome=VoteOutcome.SPLIT,
        selected_action=None,
        agreeing_controllers=[],
        rejected_controllers=rejected + [c.controller_id for c in candidates],
        reason="all controllers disagree",
    )
