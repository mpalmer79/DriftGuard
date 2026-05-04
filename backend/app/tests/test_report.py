import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import reset_state_for_tests
from app.main import create_app
from app.persistence.database import Database
from app.persistence.repository import SimulationRepository
from app.reporting import build_report, render_markdown
from app.simulation.orchestrator import Simulation


@pytest.fixture
def client():
    reset_state_for_tests()
    return TestClient(create_app())


def test_build_report_contains_required_sections():
    db = Database(":memory:")
    repo = SimulationRepository(db)
    sim = Simulation("rep_1", seed=2)
    repo.create_simulation(sim)
    for r in sim.run(5):
        repo.save_step(sim.id, r)

    report = build_report(repo, sim.id)
    expected_keys = {
        "simulation_id",
        "seed",
        "total_steps",
        "initial_state",
        "final_state",
        "final_system_mode",
        "injected_faults",
        "mode_transitions",
        "controller_trust_summary",
        "sensor_health_summary",
        "vote_outcome_counts",
        "rejected_controller_counts",
        "critical_events",
        "risk_assessment",
    }
    assert expected_keys.issubset(set(report.keys()))
    assert report["total_steps"] == 5


def test_markdown_render_is_readable():
    db = Database(":memory:")
    repo = SimulationRepository(db)
    sim = Simulation("rep_md", seed=2)
    repo.create_simulation(sim)
    for r in sim.run(3):
        repo.save_step(sim.id, r)
    md = render_markdown(build_report(repo, sim.id))
    assert "# SentinelNav Mission Report" in md
    assert "## Summary" not in md  # markdown structure uses other headings
    assert "## Mode transitions" in md
    assert "## Reproducibility" in md


def test_report_endpoints(client):
    r = client.post("/scenarios/multi_fault_failure/run/8").json()
    sid = r["simulation_id"]

    js = client.get(f"/simulations/{sid}/report/json").json()
    assert js["simulation_id"] == sid
    assert js["risk_assessment"]["level"] in {
        "NOMINAL",
        "LOW",
        "MODERATE",
        "ELEVATED",
        "HIGH",
        "UNKNOWN",
    }

    md = client.get(f"/simulations/{sid}/report/markdown").text
    assert "Mission Report" in md
    assert sid in md


def test_report_404_for_unknown(client):
    assert client.get("/simulations/nope/report").status_code == 404
