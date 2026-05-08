import type { ComponentTrustSnapshot } from "@/types/api";

interface TrustScorePanelProps {
  snapshot?: Record<string, ComponentTrustSnapshot> | null;
}

const STATUS_TEXT: Record<string, string> = {
  HEALTHY: "text-status-nominal",
  RECOVERING: "text-status-safemode",
  SUSPECT: "text-status-degraded",
  DEGRADED: "text-status-degraded",
  CRITICAL: "text-status-failed",
};

interface GlobalEntry {
  disagreement_rate?: number;
}

function isComponent(
  v: ComponentTrustSnapshot | GlobalEntry | undefined
): v is ComponentTrustSnapshot {
  return !!v && typeof (v as ComponentTrustSnapshot).status === "string";
}

export function TrustScorePanel({ snapshot }: TrustScorePanelProps) {
  if (!snapshot || Object.keys(snapshot).length === 0) {
    return (
      <section
        aria-label="Trust snapshot"
        data-testid="trust-score-panel"
        className="border border-border rounded-md p-3"
      >
        <p className="font-mono text-xs text-text-muted">Trust snapshot unavailable.</p>
      </section>
    );
  }

  const entries = Object.entries(snapshot)
    .filter(([k]) => k !== "_global")
    .filter(([, v]) => isComponent(v as ComponentTrustSnapshot))
    .sort(([a], [b]) => a.localeCompare(b)) as [string, ComponentTrustSnapshot][];
  const global = (snapshot as Record<string, GlobalEntry>)._global as GlobalEntry | undefined;

  return (
    <section
      aria-label="Trust snapshot"
      data-testid="trust-score-panel"
      className="border border-border rounded-md p-3 space-y-2"
    >
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-left text-text-muted uppercase tracking-wider text-[10px]">
            <th className="py-1 font-normal">component</th>
            <th className="font-normal">status</th>
            <th className="font-normal">trust</th>
            <th className="font-normal">fault</th>
            <th className="font-normal">clean</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([cid, h]) => {
            const trustValue = typeof h.trust === "number" ? h.trust.toFixed(2) : "—";
            const statusClass = STATUS_TEXT[h.status] ?? "text-text-primary";
            return (
              <tr key={cid} data-testid={`trust-row-${cid}`} className="border-t border-border">
                <td className="py-1 text-text-primary">{cid}</td>
                <td className={statusClass}>{h.status}</td>
                <td className="text-text-primary tabular-nums">{trustValue}</td>
                <td className="text-text-primary tabular-nums">{h.fault_streak ?? 0}</td>
                <td className="text-text-primary tabular-nums">{h.clean_streak ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {global && typeof global.disagreement_rate === "number" && (
        <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          disagreement rate: {(global.disagreement_rate * 100).toFixed(0)}%
        </p>
      )}
    </section>
  );
}
