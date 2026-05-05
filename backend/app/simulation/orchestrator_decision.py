"""Build a SystemDecision from a vote result and a target mode.

Extracted from ``orchestrator.py`` so the step loop in that file
stays readable and the file stays under the 200-line ceiling.
"""

from __future__ import annotations

from ..domain.enums import SystemMode, VoteOutcome
from ..domain.models import SystemDecision, VoteResult
from .safe_mode import SafeModeManager


def build_decision(
    step: int,
    vote_result: VoteResult,
    new_mode: SystemMode,
    justification: str,
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
    )
