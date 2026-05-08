import type { SimulationEvent } from "@/types/api";

const SEVERITY_CLASS: Record<string, string> = {
  INFO: "text-text-muted",
  WARNING: "text-status-degraded",
  CRITICAL: "text-status-failed",
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
      <section
        aria-label="Events"
        className="surface-elevated-grad border border-border rounded-md p-4"
      >
        <h2 className="font-mono uppercase text-sm tracking-wider text-text-primary mb-2">
          Events
        </h2>
        <p className="font-mono text-xs text-text-muted">No events yet.</p>
      </section>
    );
  }
  const shown = events.slice(-limit).reverse();
  return (
    <details className="surface-elevated-grad border border-border rounded-md group">
      <summary className="cursor-pointer p-4 flex items-center justify-between gap-3 flex-wrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
        <span className="font-mono uppercase text-sm tracking-wider text-text-primary">Events</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          {events.length} total / showing {Math.min(limit, events.length)}
        </span>
      </summary>
      <div className="px-4 pb-4">
        <ol className="space-y-1 text-xs max-h-96 overflow-y-auto border-t border-border pt-2">
          {shown.map((e) => (
            <li key={e.event_id} className="flex gap-3 border-b border-border/50 pb-1 font-mono">
              <span className="text-text-muted w-12 shrink-0">step {e.step}</span>
              <span className="w-20 shrink-0 text-text-muted opacity-80 truncate">
                {e.component}
              </span>
              <span className="w-20 shrink-0 text-text-muted opacity-80 truncate">{e.type}</span>
              <span className={`flex-1 break-words ${SEVERITY_CLASS[e.severity] ?? ""}`}>
                {e.message}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}
