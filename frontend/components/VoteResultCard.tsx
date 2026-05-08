import type { VoteResult } from "@/types/api";

interface VoteResultCardProps {
  vote: VoteResult | null;
}

const OUTCOME_CHIP: Record<string, string> = {
  CONSENSUS: "text-status-nominal border-status-nominal/40 bg-status-nominal/10",
  SPLIT: "text-status-degraded border-status-degraded/40 bg-status-degraded/10",
  INSUFFICIENT_DATA: "text-status-safemode border-status-safemode/40 bg-status-safemode/10",
};

function rationale(vote: VoteResult): string {
  switch (vote.outcome) {
    case "CONSENSUS":
      return `Majority consensus: ${vote.selected_action ?? "—"}`;
    case "SPLIT":
      return "No consensus — controllers disagree.";
    case "INSUFFICIENT_DATA":
      return "Insufficient valid controllers — defaulting to safe action.";
    default:
      return vote.outcome;
  }
}

export function VoteResultCard({ vote }: VoteResultCardProps) {
  if (!vote) {
    return (
      <section
        aria-label="Vote result"
        data-testid="vote-result-card"
        className="border border-border rounded-md p-3"
      >
        <p className="font-mono text-xs text-text-muted">No vote recorded.</p>
      </section>
    );
  }
  const chip = OUTCOME_CHIP[vote.outcome] ?? OUTCOME_CHIP.SPLIT;
  return (
    <section
      aria-label="Vote result"
      data-testid="vote-result-card"
      className="border border-border rounded-md p-3 space-y-2"
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md border font-mono text-[11px] uppercase tracking-wider ${chip}`}
        >
          {vote.outcome}
        </span>
        {vote.selected_action && (
          <span className="font-mono text-xs uppercase tracking-wide text-accent">
            → {vote.selected_action}
          </span>
        )}
      </div>
      <p className="font-mono text-[11px] uppercase tracking-wide text-text-primary">
        {rationale(vote)}
      </p>
      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
        <div>
          <p className="uppercase tracking-wider text-text-muted text-[10px] mb-0.5">Agreeing</p>
          {vote.agreeing_controllers.length === 0 ? (
            <p className="text-text-muted">—</p>
          ) : (
            <ul className="space-y-0.5">
              {vote.agreeing_controllers.map((c) => (
                <li key={c} className="text-status-nominal">
                  {c}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="uppercase tracking-wider text-text-muted text-[10px] mb-0.5">Rejected</p>
          {vote.rejected_controllers.length === 0 ? (
            <p className="text-text-muted">—</p>
          ) : (
            <ul className="space-y-0.5">
              {vote.rejected_controllers.map((c) => (
                <li key={c} className="text-status-degraded">
                  {c}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
