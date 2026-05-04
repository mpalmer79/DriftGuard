import type { VoteResult } from "@/types/api";
import { Card } from "./Card";

export function VoteResultCard({ vote }: { vote: VoteResult | null }) {
  if (!vote) {
    return (
      <Card title="Vote result">
        <p className="text-gray-500 text-sm">No vote recorded.</p>
      </Card>
    );
  }
  return (
    <Card title="Vote result">
      <div className="flex items-baseline gap-4 mb-2">
        <span className="text-lg font-semibold">{vote.outcome}</span>
        {vote.selected_action && (
          <span className="text-sentinel-accent">→ {vote.selected_action}</span>
        )}
      </div>
      <p className="text-sm text-gray-400">{vote.reason}</p>
      <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
        <div>
          <div className="text-gray-400 mb-1">agreeing</div>
          <ul>{vote.agreeing_controllers.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
        <div>
          <div className="text-gray-400 mb-1">rejected</div>
          <ul>{vote.rejected_controllers.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      </div>
    </Card>
  );
}
