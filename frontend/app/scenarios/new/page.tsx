"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";

const TEMPLATES: Record<string, string> = {
  blank: `name: my_scenario
description: Plain-language description.
expected_behavior: What the operator should expect.
seed: 42
steps: 20
`,
  drift_then_recover: `name: my_drift
description: Sensor drift ramps up then clears.
expected_behavior: System enters DEGRADED then recovers.
seed: 23
steps: 25
faults:
  - type: SENSOR_DRIFT
    target: sensor
    start_step: 3
    duration: 8
    metadata:
      magnitude: { ramp: [0, 6, 8] }
`,
  multi_fault: `name: my_multi
description: Sensor dropout plus controller silent failure.
expected_behavior: Escalates to FAILED.
seed: 5
steps: 20
faults:
  - type: SENSOR_DROPOUT
    target: sensor
    start_step: 3
    duration: 20
    metadata:
      probability: 0.6
  - type: CONTROLLER_SILENT_FAILURE
    target: controller_b
    start_step: 6
    duration: 20
`,
};

export default function NewScenarioPage() {
  const router = useRouter();
  const [yaml, setYaml] = useState(TEMPLATES.blank);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createAndRun() {
    setBusy(true);
    setError(null);
    try {
      const scenario = await api.createScenario(yaml);
      const result = await api.runScenario(scenario.name);
      router.push(`/simulations/${result.simulation_id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function validateOnly() {
    setBusy(true);
    setError(null);
    try {
      const scenario = await api.createScenario(yaml);
      // Created — clean up so the user can re-validate without
      // collisions. Best-effort: ignore delete failures.
      try {
        await api.deleteScenario(scenario.name);
      } catch {
        // ignore
      }
      setError(`OK — '${scenario.name}' is valid.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Author scenario</h1>
        <select
          aria-label="template"
          className="bg-dg-panel border border-dg-border rounded px-2 py-1 text-sm"
          onChange={(e) => setYaml(TEMPLATES[e.target.value] ?? TEMPLATES.blank)}
        >
          <option value="blank">blank</option>
          <option value="drift_then_recover">drift then recover</option>
          <option value="multi_fault">multi-fault</option>
        </select>
        <div className="ml-auto flex gap-2">
          <button
            onClick={validateOnly}
            disabled={busy}
            className="px-3 py-1 rounded border border-dg-border text-sm disabled:opacity-50"
          >
            validate
          </button>
          <button
            onClick={createAndRun}
            disabled={busy}
            className="px-3 py-1 rounded bg-dg-accent/20 border border-dg-accent/40 text-sm disabled:opacity-50"
          >
            create + run
          </button>
        </div>
      </header>

      <Card title="YAML">
        <textarea
          value={yaml}
          onChange={(e) => setYaml(e.target.value)}
          spellCheck={false}
          className="w-full h-96 bg-black/40 border border-dg-border rounded p-3 text-xs font-mono"
        />
      </Card>

      {error && (
        <Card>
          <pre className="text-xs whitespace-pre-wrap">{error}</pre>
        </Card>
      )}

      <Card title="Notes">
        <ul className="text-sm space-y-1 text-gray-300 list-disc list-inside">
          <li>
            Schema is documented in <code>docs/FAULT_MODEL.md</code> and
            <code>backend/app/scenarios/schema.yaml</code>.
          </li>
          <li>
            Fault metadata supports the <code>{"{ ramp: [from, to, steps] }"}</code> DSL term.
          </li>
          <li>Built-in scenario names are immutable. Pick a fresh name.</li>
          <li>
            <em>validate</em> registers, then deletes so you can iterate without collisions.
          </li>
        </ul>
      </Card>
    </div>
  );
}
