"""Hypothesis strategies shared across property tests.

The strategies generate (seed, scenario, step count) tuples and run
the simulation through ``run_scenario``. Centralized so each
invariant test can stay focused on the assertion.
"""

from __future__ import annotations

from hypothesis import strategies as st

from app.scenarios import all_scenarios, run_scenario

SCENARIO_NAMES = [s.name for s in all_scenarios()]


def scenario_runs(min_steps: int = 1, max_steps: int = 12):
    """Generate ``(simulation, scenario_result)`` tuples.

    The strategy maps ``(scenario_name, steps)`` directly to a
    completed run. Hypothesis caches strategies, not results, so each
    example actually executes the simulation — which is the point: we
    want the property to hold for whatever timeline the scenario
    produced under that step count.
    """

    return st.builds(
        run_scenario,
        st.sampled_from(SCENARIO_NAMES),
        st.integers(min_value=min_steps, max_value=max_steps),
    )
