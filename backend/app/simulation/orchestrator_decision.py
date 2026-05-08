"""Build a SystemDecision from a vote result and a target mode.

Extracted from ``orchestrator.py`` so the step loop in that file
stays readable and the file stays under the 200-line ceiling.
"""

from __future__ import annotations

from typing import Any

from ..domain.enums import SystemMode, VoteOutcome
from ..domain.models import SystemDecision, VoteResult
from .safe_mode import SafeModeManager


def _build_vote_split(vote_result: VoteResult) -> dict[str, Any]:
    """Compact, JSON-friendly summary of a vote — the operator console's
    "Controller Vote" panel reads this without having to re-resolve the
    full vote_results row.
    """

    return {
        "outcome": vote_result.outcome.value,
        "selected_action": (
            vote_result.selected_action.value if vote_result.selected_action else None
        ),
        "agreeing": list(vote_result.agreeing_controllers),
        "rejected": list(vote_result.rejected_controllers),
        "reason": vote_result.reason,
    }


def build_decision(
    step: int,
    vote_result: VoteResult,
    new_mode: SystemMode,
    justification: str,
    *,
    previous_mode: SystemMode = SystemMode.NORMAL,
    active_fault_ids: list[str] | None = None,
    detector_findings: list[dict[str, Any]] | None = None,
) -> SystemDecision:
    if vote_result.outcome == VoteOutcome.CONSENSUS and vote_result.selected_action is not None:
        chosen = vote_result.selected_action
    else:
        chosen = SafeModeManager.fallback_action(new_mode)
    final_action = SafeModeManager.restrict_action(new_mode, chosen)
    return SystemDecision(
        step=step,
        final_action=final_action,
        system_mode=new_mode,
        safe_mode_active=new_mode in (SystemMode.SAFE_MODE, SystemMode.FAILED),
        justification=justification,
        trusted_controllers=vote_result.agreeing_controllers,
        rejected_controllers=vote_result.rejected_controllers,
        previous_mode=previous_mode,
        # `trigger_reason` is the operator-friendly alias for
        # `justification`. We keep both to avoid breaking existing
        # clients while letting the UI bind to the clearer name.
        trigger_reason=justification,
        active_fault_ids=list(active_fault_ids or []),
        detector_findings=list(detector_findings or []),
        vote_split=_build_vote_split(vote_result),
    )
