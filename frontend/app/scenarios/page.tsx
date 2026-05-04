"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Scenario } from "@/types/api";
import { ScenarioCard } from "@/components/ScenarioCard";

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listScenarios().then(setScenarios).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Scenarios</h1>
        <p className="text-gray-400 text-sm mt-1">
          Each scenario is deterministic. Same seed plus same fault schedule
          produces the same decisions and events.
        </p>
      </header>

      {error && <p className="text-sentinel-bad text-sm">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {scenarios.map((s) => (
          <ScenarioCard key={s.name} scenario={s} />
        ))}
      </div>
    </div>
  );
}
