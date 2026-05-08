"use client";

// DecisionPipeline — visual chain of the per-step decision pipeline.
//
// The kernel produces a deterministic chain at every simulation step:
//
//     Sensor → Controllers → Voter → Detectors → Mode → Action
//
// This component renders that chain as a horizontal sequence of small
// stage cards (vertical on small screens) so an operator can see, at
// a glance, how the inputs at one stage shape the outputs of the
// next. Each stage's chip is colored using existing status tokens
// (`text-status-{nominal,degraded,safemode,failed}`) and is keyed off
// a single `TimelineEntry` prop — the timeline endpoint already
// bundles state/sensor/controllers/vote/decision/events for every
// step, so we don't need to invent any data.
//
// Mobile note: at < md breakpoint the stages stack vertically with a
// downward chevron; at md+ they sit side-by-side with a `→` arrow.
// We do this with a single set of utility classes (no JS branching)
// so the component remains SSR-safe.

import type { TimelineEntry } from "@/types/api";
import { EmptyState } from "./ui/EmptyState";

// Severity → status-token classes. We use Tailwind's static class
// names rather than CSS variables here so the content scanner picks
// them up, matching the pattern in CausalityPanel.
const STATUS_CLASS = {
  nominal: "text-status-nominal border-status-nominal/40 bg-status-nominal/10",
  degraded: "text-status-degraded border-status-degraded/40 bg-status-degraded/10",
  safemode: "text-status-safemode border-status-safemode/40 bg-status-safemode/10",
  failed: "text-status-failed border-status-failed/40 bg-status-failed/10",
  muted: "text-text-muted border-border bg-surface",
} as const;

type StatusToken = keyof typeof STATUS_CLASS;

// Map a fault/severity string into a status token. The detector
// component statuses (HEALTHY/SUSPECT/DEGRADED/CRITICAL/RECOVERING)
// arrive verbatim from the kernel, so we accept either casing.
function severityToken(severity: string | null | undefined): StatusToken {
  switch ((severity ?? "").toUpperCase()) {
    case "HEALTHY":
      return "nominal";
    case "SUSPECT":
    case "DEGRADED":
    case "WARNING":
      return "degraded";
    case "CRITICAL":
    case "FAILED":
      return "failed";
    case "RECOVERING":
    case "SAFE_MODE":
      return "safemode";
    default:
      return "muted";
  }
}

// Sensor stage uses the SensorStatus enum (OK/DEGRADED/INVALID).
function sensorToken(status: string | undefined, flags: string[]): StatusToken {
  if ((status ?? "").toUpperCase() === "OK" && flags.length === 0) return "nominal";
  if ((status ?? "").toUpperCase() === "INVALID") return "failed";
  return "degraded";
}

function modeToken(mode: string | null | undefined): StatusToken {
  switch ((mode ?? "").toUpperCase()) {
    case "NORMAL":
      return "nominal";
    case "DEGRADED":
      return "degraded";
    case "SAFE_MODE":
      return "safemode";
    case "FAILED":
      return "failed";
    default:
      return "muted";
  }
}

function voteToken(outcome: string | null | undefined): StatusToken {
  switch ((outcome ?? "").toUpperCase()) {
    case "CONSENSUS":
      return "nominal";
    case "SPLIT":
      return "degraded";
    case "INSUFFICIENT_DATA":
      return "failed";
    default:
      return "muted";
  }
}

interface ChipProps {
  token: StatusToken;
  children: React.ReactNode;
  title?: string;
}

function Chip({ token, children, title }: ChipProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono text-[10px] uppercase tracking-wider ${STATUS_CLASS[token]}`}
    >
      {children}
    </span>
  );
}

interface StageProps {
  label: string;
  token: StatusToken;
  children: React.ReactNode;
  testId?: string;
}

function Stage({ label, token, children, testId }: StageProps) {
  return (
    <div
      data-testid={testId}
      className={`flex-1 min-w-[140px] rounded-md border p-2 space-y-1 ${STATUS_CLASS[token]}`}
    >
      <p className="font-mono uppercase text-[10px] tracking-wider opacity-80">{label}</p>
      <div className="text-text-primary text-xs space-y-1">{children}</div>
    </div>
  );
}

// Connector arrow — horizontal at md+, vertical (down) below md.
function Connector() {
  return (
    <div
      aria-hidden
      className="flex items-center justify-center text-text-muted font-mono text-xs select-none"
    >
      <span className="hidden md:inline">→</span>
      <span className="inline md:hidden">↓</span>
    </div>
  );
}

interface DecisionPipelineProps {
  step: TimelineEntry | null;
}

export function DecisionPipeline({ step }: DecisionPipelineProps) {
  if (!step) {
    return (
      <section
        aria-label="Decision pipeline"
        className="surface-elevated-grad border border-border rounded-md p-4 space-y-3"
      >
        <h2 className="font-mono uppercase text-sm tracking-wider text-text-primary">
          Decision Pipeline
        </h2>
        <EmptyState
          title="// NO STEP SELECTED"
          description="Step the simulation or pick a row in the timeline to inspect the pipeline."
        />
      </section>
    );
  }

  const { sensor, controllers, vote, decision } = step;

  // -- Stage 1: Sensor -----------------------------------------------
  const sensorStatus = sensor?.status ?? "OK";
  const sensorFlags = sensor?.fault_flags ?? [];
  const sensorTokenValue = sensorToken(sensorStatus, sensorFlags);

  // -- Stage 2: Controllers ------------------------------------------
  // Worst-case token: any invalid controller pushes the stage to
  // degraded; otherwise nominal.
  const ctrlAnyInvalid = controllers.some((c) => !c.valid);
  const ctrlToken: StatusToken = ctrlAnyInvalid ? "degraded" : "nominal";

  // -- Stage 3: Voter -------------------------------------------------
  const voteOutcome = decision.vote_split?.outcome ?? vote?.outcome ?? null;
  const voteAction =
    decision.vote_split?.selected_action ?? vote?.selected_action ?? decision.final_action;
  const voteReason = decision.vote_split?.reason ?? vote?.reason ?? "";
  const voteTokenValue = voteToken(voteOutcome);

  // -- Stage 4: Detectors --------------------------------------------
  const findings = decision.detector_findings ?? [];
  // Pick the worst finding to color the stage.
  const detectorTokenValue: StatusToken = findings.reduce<StatusToken>((acc, f) => {
    const t = severityToken(f.severity);
    const order: StatusToken[] = ["nominal", "muted", "safemode", "degraded", "failed"];
    return order.indexOf(t) > order.indexOf(acc) ? t : acc;
  }, "nominal");

  // -- Stage 5: Mode --------------------------------------------------
  const previousMode = decision.previous_mode ?? null;
  const currentMode = decision.system_mode;
  const modeTokenValue = modeToken(currentMode);
  const triggerReason = decision.trigger_reason || decision.justification || "";

  // -- Stage 6: Action ------------------------------------------------
  // Final action stage colors: SAFE_MODE active flag escalates the
  // stage; otherwise it inherits the mode token.
  const actionTokenValue: StatusToken = decision.safe_mode_active ? "safemode" : modeTokenValue;

  return (
    <section
      aria-label="Decision pipeline"
      data-testid="decision-pipeline"
      className="surface-elevated-grad border border-border rounded-md p-4 space-y-3"
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-mono uppercase text-sm tracking-wider text-text-primary">
          Decision Pipeline
        </h2>
        <span className="font-mono text-[10px] tracking-wider text-text-muted">
          STEP {step.step}
        </span>
      </div>

      {/* Pipeline grid: vertical < md, horizontal >= md. */}
      <div className="flex flex-col md:flex-row md:items-stretch gap-2">
        <Stage label="Sensor" token={sensorTokenValue} testId="pipeline-sensor">
          <p className="font-mono text-xs uppercase">{sensorStatus}</p>
          {sensorFlags.length === 0 && sensorStatus === "OK" ? (
            <p className="font-mono text-[10px] text-text-muted">nominal</p>
          ) : sensorFlags.length === 0 ? (
            <p className="font-mono text-[10px] text-text-muted">no flags</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {sensorFlags.map((flag) => (
                <Chip key={flag} token="degraded">
                  {flag}
                </Chip>
              ))}
            </div>
          )}
        </Stage>

        <Connector />

        <Stage label="Controllers" token={ctrlToken} testId="pipeline-controllers">
          {controllers.length === 0 ? (
            <p className="font-mono text-[10px] text-text-muted">no controllers</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {controllers.map((c) => (
                <Chip
                  key={c.controller_id}
                  token={c.valid ? "nominal" : "degraded"}
                  title={`${c.controller_id} → ${c.action} (valid=${c.valid})`}
                >
                  {c.controller_id}: {c.action}
                </Chip>
              ))}
            </div>
          )}
        </Stage>

        <Connector />

        <Stage label="Voter" token={voteTokenValue} testId="pipeline-voter">
          <p className="font-mono text-xs uppercase">{voteOutcome ?? "—"}</p>
          <p className="font-mono text-[10px] uppercase tracking-wide text-text-primary">
            {voteAction ?? "—"}
          </p>
          {voteReason && (
            <p
              className="font-mono text-[10px] text-text-muted truncate"
              title={voteReason}
              data-testid="pipeline-voter-reason"
            >
              {voteReason}
            </p>
          )}
        </Stage>

        <Connector />

        <Stage label="Detectors" token={detectorTokenValue} testId="pipeline-detectors">
          {findings.length === 0 ? (
            <p className="font-mono text-[10px] text-text-muted">no findings</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {findings.map((f, i) => (
                <Chip
                  key={`${f.component}-${i}`}
                  token={severityToken(f.severity)}
                  title={f.message}
                >
                  {f.component}: {f.severity}
                </Chip>
              ))}
            </div>
          )}
        </Stage>

        <Connector />

        <Stage label="Mode" token={modeTokenValue} testId="pipeline-mode">
          <p className="font-mono text-xs uppercase">
            {previousMode ? `${previousMode} → ${currentMode}` : currentMode}
          </p>
          {triggerReason && (
            <p
              className="font-mono text-[10px] text-text-muted leading-snug"
              data-testid="pipeline-mode-reason"
            >
              {triggerReason}
            </p>
          )}
        </Stage>

        <Connector />

        <Stage label="Action" token={actionTokenValue} testId="pipeline-action">
          <p className="font-mono text-xs uppercase tracking-wide text-accent">
            {decision.final_action}
          </p>
          <p className="font-mono text-[10px] text-text-muted">
            safe_mode={decision.safe_mode_active ? "true" : "false"}
          </p>
        </Stage>
      </div>
    </section>
  );
}
