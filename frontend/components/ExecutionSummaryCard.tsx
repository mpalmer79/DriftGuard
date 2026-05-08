// ExecutionSummaryCard — post-run debrief for a ScenarioResult.
//
// The card is a dense, single-surface read-out of what just happened
// when a scenario was executed. It is rendered inline beneath the
// ScenarioCard (after a Run completes) and on the scenario detail
// route once the operator triggers a run.
//
// Sections (top-to-bottom):
//   * Final mode + final action + steps run
//   * Faults introduced (chips from `result.fault_summary`)
//   * Detector response — derived from the count of non-NORMAL mode
//     transitions in `result.mode_transitions`. The result payload
//     does not currently expose detector findings directly, so we
//     derive a binary "escalated / no escalation" signal from the
//     mode timeline. Documented in CLAUDE.md.
//   * Controller agreement — from `result.event_counts.VOTE` if
//     available; falls back to `result.decision_counts` otherwise.
//   * Escalation result — a one-line string of the form
//     "NORMAL → DEGRADED at step 7 → SAFE_MODE at step 12", derived
//     from `result.mode_transitions`. If only NORMAL is present, we
//     surface "No escalation occurred."
//   * Final system action — chip rendering `result.final_action`.
//   * (Optional) Expected vs actual — when the scenario prop is
//     supplied, we compare `result.final_mode` against
//     `scenario.expected_final_modes` and render a green tick chip
//     (within envelope) or amber chip (outside envelope).
//
// All chip and stripe colours come from the existing status-* tokens.
// Mobile layout: the metric grid collapses to a single column on
// `< sm`. Chip rows already use `flex-wrap`.

import type { Scenario, ScenarioResult, SystemMode } from "@/types/api";
import { SystemModeBadge } from "./SystemModeBadge";

interface ExecutionSummaryCardProps {
  result: ScenarioResult;
  scenario?: Scenario;
}

const KNOWN_MODES: ReadonlyArray<SystemMode> = ["NORMAL", "DEGRADED", "SAFE_MODE", "FAILED"];

// Static lookup for chip colour by mode name. Keeps Tailwind's
// content scanner happy and matches the convention used by
// ScenarioNarrative / CausalityPanel.
const MODE_CHIP_CLASS: Record<SystemMode, string> = {
  NORMAL: "text-status-nominal border-status-nominal/40 bg-status-nominal/10",
  DEGRADED: "text-status-degraded border-status-degraded/40 bg-status-degraded/10",
  SAFE_MODE: "text-status-safemode border-status-safemode/40 bg-status-safemode/10",
  FAILED: "text-status-failed border-status-failed/40 bg-status-failed/10",
};

function modeChipClass(mode: string): string {
  if ((KNOWN_MODES as ReadonlyArray<string>).includes(mode)) {
    return MODE_CHIP_CLASS[mode as SystemMode];
  }
  return "text-text-muted border-border bg-surface";
}

// Build "NORMAL → DEGRADED at step 7 → SAFE_MODE at step 12".
// `mode_transitions[0]` is the initial mode (typically NORMAL at
// step 0) — we keep that as the head of the string and only suffix
// "at step N" to subsequent transitions.
export function summarizeEscalation(
  transitions: { step: number; mode: string }[]
): string {
  if (!transitions || transitions.length === 0) return "No escalation occurred.";
  const distinct = transitions.filter((t, i) => i === 0 || t.mode !== transitions[i - 1].mode);
  if (distinct.length <= 1) return "No escalation occurred.";
  const head = distinct[0].mode;
  const tail = distinct
    .slice(1)
    .map((t) => `${t.mode} at step ${t.step}`)
    .join(" → ");
  return `${head} → ${tail}`;
}

// Detector response is derived: any non-initial mode transition
// signals that the kernel escalated. mode_transitions[0] is the
// initial NORMAL state — we only count post-initial transitions.
export function describeDetectorResponse(
  transitions: { step: number; mode: string }[]
): string {
  if (!transitions || transitions.length <= 1) return "No escalation";
  return "Detector escalated";
}

// Pull vote counts. Prefer `event_counts` (kernel-emitted VOTE
// events have `outcome` metadata, but ScenarioResult only exposes
// the aggregate count). Falls back to decision_counts so something
// shows up for older payloads.
function voteSummary(result: ScenarioResult): string {
  const ev = result.event_counts ?? {};
  const dc = result.decision_counts ?? {};
  // ScenarioResult flattens VOTE into a single bucket. If the
  // backend ever splits by outcome, we'll surface it here. For now
  // we report the aggregate "VOTE n" alongside any outcome-keyed
  // entries we recognise.
  const consensus = ev.CONSENSUS ?? dc.CONSENSUS;
  const split = ev.SPLIT ?? dc.SPLIT;
  const insufficient = ev.INSUFFICIENT_DATA ?? dc.INSUFFICIENT_DATA;
  if (
    consensus !== undefined ||
    split !== undefined ||
    insufficient !== undefined
  ) {
    return `Consensus: ${consensus ?? 0} / Split: ${split ?? 0} / Insufficient: ${insufficient ?? 0}`;
  }
  if (typeof ev.VOTE === "number") return `${ev.VOTE} vote events`;
  return "Vote stats unavailable";
}

function isWithinEnvelope(finalMode: SystemMode, expected?: string[]): boolean {
  if (!expected || expected.length === 0) return false;
  return expected.includes(finalMode);
}

interface SummaryRowProps {
  label: string;
  children: React.ReactNode;
}

function SummaryRow({ label, children }: SummaryRowProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-x-3 gap-y-1">
      <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
      <div className="text-sm text-text-primary leading-relaxed break-words">{children}</div>
    </div>
  );
}

function FaultChip({ type, target }: { type: string; target: string }) {
  return (
    <span
      data-testid="exec-summary-fault-chip"
      className="inline-flex items-baseline gap-2 px-2.5 py-1 rounded-md border border-status-degraded/40 bg-status-degraded/10 text-status-degraded font-mono text-[11px] uppercase tracking-wider"
    >
      <span>{type}</span>
      <span className="opacity-60">→</span>
      <span>{target}</span>
    </span>
  );
}

function ModeChip({ mode }: { mode: string }) {
  return (
    <span
      data-testid="exec-summary-mode-chip"
      className={`inline-flex items-center px-2.5 py-1 rounded-md border font-mono uppercase text-[11px] tracking-wider ${modeChipClass(
        mode
      )}`}
    >
      {mode}
    </span>
  );
}

export function ExecutionSummaryCard({ result, scenario }: ExecutionSummaryCardProps) {
  const escalation = summarizeEscalation(result.mode_transitions ?? []);
  const detectorResponse = describeDetectorResponse(result.mode_transitions ?? []);
  const votes = voteSummary(result);

  const expected = scenario?.expected_final_modes;
  const withinEnvelope = expected ? isWithinEnvelope(result.final_mode, expected) : null;

  return (
    <article
      data-testid="execution-summary-card"
      aria-label={`Execution summary for ${result.scenario}`}
      className="bg-surface-elevated border border-border rounded-md p-5 space-y-4"
    >
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          {"// EXECUTION SUMMARY"}
        </p>
        <a
          className="font-mono text-[11px] uppercase tracking-wider text-accent hover:underline"
          href={`/simulations/${result.simulation_id}`}
        >
          view simulation →
        </a>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-[auto_auto_auto] gap-x-6 gap-y-3 items-baseline">
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Final mode
          </p>
          <SystemModeBadge mode={result.final_mode} />
        </div>
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Final action
          </p>
          <p className="font-mono text-sm text-text-primary uppercase tracking-wider break-all">
            {result.final_action}
          </p>
        </div>
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Steps run
          </p>
          <p className="font-mono text-sm text-text-primary">{result.steps_run}</p>
        </div>
      </div>

      <SummaryRow label="Faults introduced">
        {result.fault_summary && result.fault_summary.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {result.fault_summary.map((f, i) => (
              <FaultChip key={`${f.fault_id ?? i}`} type={f.type} target={f.target} />
            ))}
          </div>
        ) : (
          <p className="font-mono text-xs text-text-muted">No faults injected.</p>
        )}
      </SummaryRow>

      <SummaryRow label="Detector response">
        <span data-testid="exec-summary-detector" className="font-mono text-xs text-text-primary">
          {detectorResponse}
        </span>
      </SummaryRow>

      <SummaryRow label="Controller agreement">
        <span data-testid="exec-summary-votes" className="font-mono text-xs text-text-primary">
          {votes}
        </span>
      </SummaryRow>

      <SummaryRow label="Escalation result">
        <p data-testid="exec-summary-escalation" className="font-mono text-xs text-text-primary">
          {escalation}
        </p>
      </SummaryRow>

      <SummaryRow label="Final system action">
        <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-border bg-surface font-mono uppercase text-[11px] tracking-wider text-text-primary">
          {result.final_action}
        </span>
      </SummaryRow>

      {scenario && expected && (
        <section
          data-testid="exec-summary-expected-vs-actual"
          className="border-t border-border pt-3 space-y-2"
        >
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Expected vs actual
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
              Expected envelope:
            </span>
            {expected.map((mode, i) => (
              <ModeChip key={`${mode}-${i}`} mode={mode} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
              Actual final:
            </span>
            <ModeChip mode={result.final_mode} />
            {withinEnvelope ? (
              <span
                data-testid="exec-summary-envelope-result"
                data-result="within"
                className="inline-flex items-center px-2.5 py-1 rounded-md border border-status-nominal/40 bg-status-nominal/10 text-status-nominal font-mono uppercase text-[11px] tracking-wider"
              >
                Within expected envelope
              </span>
            ) : (
              <span
                data-testid="exec-summary-envelope-result"
                data-result="outside"
                className="inline-flex items-center px-2.5 py-1 rounded-md border border-status-degraded/40 bg-status-degraded/10 text-status-degraded font-mono uppercase text-[11px] tracking-wider"
              >
                Outside expected envelope
              </span>
            )}
          </div>
        </section>
      )}
    </article>
  );
}
