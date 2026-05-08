import type { ControllerOutput, VoteResult } from "@/types/api";

const LATENCY_BUDGET_MS = 150;

interface ControllerOutputTableProps {
  outputs: ControllerOutput[];
  vote?: VoteResult | null;
}

type Bucket = "agreeing" | "rejected" | "neutral";

const ROW_CLASS: Record<Bucket, string> = {
  agreeing: "bg-status-nominal/5",
  rejected: "bg-status-degraded/5",
  neutral: "",
};

const BUCKET_TEXT: Record<Bucket, string> = {
  agreeing: "text-status-nominal",
  rejected: "text-status-degraded",
  neutral: "text-text-primary",
};

function bucketFor(controllerId: string, vote?: VoteResult | null): Bucket {
  if (!vote) return "neutral";
  if (vote.agreeing_controllers?.includes(controllerId)) return "agreeing";
  if (vote.rejected_controllers?.includes(controllerId)) return "rejected";
  return "neutral";
}

export function ControllerOutputTable({ outputs, vote }: ControllerOutputTableProps) {
  if (!outputs || outputs.length === 0) {
    return (
      <section
        aria-label="Controller outputs"
        data-testid="controller-output-table"
        className="border border-border rounded-md p-3"
      >
        <p className="font-mono text-xs text-text-muted">No controller outputs.</p>
      </section>
    );
  }
  return (
    <section
      aria-label="Controller outputs"
      data-testid="controller-output-table"
      className="border border-border rounded-md p-3"
    >
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-left text-text-muted uppercase tracking-wider text-[10px]">
            <th className="py-1 font-normal">controller</th>
            <th className="font-normal">action</th>
            <th className="font-normal">conf</th>
            <th className="font-normal">rt</th>
            <th className="font-normal">valid</th>
          </tr>
        </thead>
        <tbody>
          {outputs.map((o) => {
            const bucket = bucketFor(o.controller_id, vote);
            const overBudget = o.response_time_ms > LATENCY_BUDGET_MS;
            const confidencePct = Math.round((o.confidence ?? 0) * 100);
            return (
              <tr
                key={o.controller_id}
                data-testid={`controller-row-${o.controller_id}`}
                className={`border-t border-border ${ROW_CLASS[bucket]}`}
              >
                <td className={`py-1 ${BUCKET_TEXT[bucket]}`}>{o.controller_id}</td>
                <td className={BUCKET_TEXT[bucket]}>{o.action}</td>
                <td className="text-text-primary tabular-nums">{confidencePct}%</td>
                <td
                  className={`tabular-nums ${
                    overBudget ? "text-status-failed" : "text-text-primary"
                  }`}
                >
                  {o.response_time_ms} ms
                </td>
                <td className={o.valid ? "text-status-nominal" : "text-status-failed"}>
                  {o.valid ? "yes" : "no"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
