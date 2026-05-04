import type { VehicleState } from "@/types/api";
import { Card } from "./Card";
import { SystemModeBadge } from "./SystemModeBadge";

export function VehicleStateCard({ state }: { state: VehicleState | null }) {
  if (!state) {
    return (
      <Card title="Vehicle state">
        <p className="text-gray-500 text-sm">No state available.</p>
      </Card>
    );
  }
  const rows: [string, string | number][] = [
    ["step", state.step],
    ["altitude", state.altitude.toFixed(2)],
    ["velocity", state.velocity.toFixed(2)],
    ["heading", state.heading.toFixed(2)],
    ["pitch", state.pitch.toFixed(2)],
    ["roll", state.roll.toFixed(2)],
    ["last action", state.last_action ?? "—"],
  ];
  return (
    <Card title="Vehicle state">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-400">simulation</span>
        <SystemModeBadge mode={state.system_mode} />
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <dt className="text-gray-400">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
