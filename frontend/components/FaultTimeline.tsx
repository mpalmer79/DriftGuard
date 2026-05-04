import type { FaultRecord } from "@/types/api";
import { Card } from "./Card";

export function FaultTimeline({ faults }: { faults: FaultRecord[] }) {
  if (!faults || faults.length === 0) {
    return (
      <Card title="Faults">
        <p className="text-gray-500 text-sm">No faults injected.</p>
      </Card>
    );
  }
  return (
    <Card title={`Faults (${faults.length})`}>
      <ul className="text-xs space-y-1">
        {faults.map((f) => (
          <li key={f.fault_id} className="flex gap-3 border-b border-sentinel-border/50 pb-1">
            <span className="text-sentinel-warn w-44">{f.type}</span>
            <span className="w-32 opacity-80">{f.target}</span>
            <span className="opacity-70">
              steps {f.start_step}–{f.end_step ?? "∞"}
            </span>
            <span className="ml-auto opacity-60">{f.severity}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
