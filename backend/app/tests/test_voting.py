from app.domain.enums import Action, VoteOutcome
from app.domain.models import ControllerOutput
from app.simulation.voting import vote


def _out(cid, action, valid=True, rt=10.0):
    return ControllerOutput(
        controller_id=cid,
        step=1,
        action=action,
        confidence=0.8,
        reason_code="X",
        response_time_ms=rt,
        valid=valid,
    )


def test_consensus_majority():
    outs = [
        _out("a", Action.HOLD),
        _out("b", Action.HOLD),
        _out("c", Action.ASCEND),
    ]
    r = vote(outs, latency_threshold_ms=50.0)
    assert r.outcome == VoteOutcome.CONSENSUS
    assert r.selected_action == Action.HOLD
    assert set(r.agreeing_controllers) == {"a", "b"}
    assert "c" in r.rejected_controllers


def test_split_all_disagree():
    outs = [
        _out("a", Action.HOLD),
        _out("b", Action.ASCEND),
        _out("c", Action.DESCEND),
    ]
    r = vote(outs, latency_threshold_ms=50.0)
    assert r.outcome == VoteOutcome.SPLIT
    assert r.selected_action is None


def test_insufficient_data_due_to_invalid():
    outs = [
        _out("a", Action.HOLD, valid=False),
        _out("b", Action.HOLD, valid=False),
        _out("c", Action.ASCEND),
    ]
    r = vote(outs, latency_threshold_ms=50.0)
    assert r.outcome == VoteOutcome.INSUFFICIENT_DATA


def test_latency_excludes_controller():
    outs = [
        _out("a", Action.HOLD, rt=200.0),
        _out("b", Action.HOLD),
        _out("c", Action.HOLD),
    ]
    r = vote(outs, latency_threshold_ms=50.0)
    assert r.outcome == VoteOutcome.CONSENSUS
    assert "a" in r.rejected_controllers
