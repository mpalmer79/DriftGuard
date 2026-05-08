import type { SimulationEvent } from "@/types/api";
import { Card } from "./Card";

const severityColor: Record<string, string> = {
  INFO: "text-gray-400",
  WARNING: "text-dg-warn",
  CRITICAL: "text-dg-bad",
};

export function EventTimeline({
  events,
  limit = 50,
}: {
  events: SimulationEvent[];
  limit?: number;
}) {
  if (!events || events.length === 0) {
    return (
      <Card title="Events">
        <p className="text-gray-500 text-sm">No events yet.</p>
      </Card>
    );
  }
  const shown = events.slice(-limit).reverse();
  return (
    <Card title={`Events (${events.length})`}>
      <ol className="space-y-1 text-xs max-h-96 overflow-y-auto">
        {shown.map((e) => (
          <li key={e.event_id} className="flex gap-3 border-b border-dg-border/50 pb-1">
            <span className="text-gray-500 w-12">step {e.step}</span>
            <span className="w-20 opacity-70">{e.component}</span>
            <span className="w-20 opacity-70">{e.type}</span>
            <span className={`flex-1 ${severityColor[e.severity] ?? ""}`}>{e.message}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
