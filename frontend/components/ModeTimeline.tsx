// ModeTimeline — visual mode-progression band for a single run.
//
// Given the per-step DecisionRecord stream, the component collapses
// adjacent steps that share the same `system_mode` into a single
// segment. Each segment renders a coloured chip showing:
//
//   * the mode name (NORMAL / DEGRADED / SAFE_MODE / FAILED),
//   * the inclusive step range (e.g. `step 3–7`),
//   * and — on hover via the native `title` attribute — the first
//     decision's `justification` so an operator can see why that
//     mode segment opened.
//
// `currentStep` is optional. When present, the segment that contains
// that step is rendered with a thicker border + accent ring so the
// operator can scan to "here is where I am right now". The marker
// is a static class lookup so Tailwind's content scanner emits the
// concrete utility names at build time.
//
// Layout responsiveness:
//   * `flex flex-wrap` keeps segments on one row at small widths and
//     wraps them onto a vertical column once the container is too
//     narrow. Each segment fills its row on `< sm` for legibility.
//
// Empty state:
//   * If `decisions` is empty, we render a neutral hint that the
//     operator should run a step. No skeleton — empty is meaningful.

import type { DecisionRecord, SystemMode } from "@/types/api";

interface ModeTimelineProps {
  decisions: DecisionRecord[];
  currentStep?: number;
}

interface ModeSegment {
  mode: SystemMode;
  startStep: number;
  endStep: number; // inclusive
  justification: string;
}

// Static class lookup — Tailwind's content scanner needs concrete
// utility names, so we cannot interpolate `bg-${token}` here.
const MODE_SEGMENT_CLASS: Record<SystemMode, string> = {
  NORMAL: "text-status-nominal border-status-nominal/40 bg-status-nominal/10",
  DEGRADED: "text-status-degraded border-status-degraded/40 bg-status-degraded/10",
  SAFE_MODE: "text-status-safemode border-status-safemode/40 bg-status-safemode/10",
  FAILED: "text-status-failed border-status-failed/40 bg-status-failed/10",
};

const KNOWN_MODES = new Set<SystemMode>(["NORMAL", "DEGRADED", "SAFE_MODE", "FAILED"]);

function modeSegmentClass(mode: string): string {
  if (KNOWN_MODES.has(mode as SystemMode)) {
    return MODE_SEGMENT_CLASS[mode as SystemMode];
  }
  return "text-text-muted border-border bg-surface";
}

// Collapse adjacent decisions with the same `system_mode` into a
// single inclusive `[startStep, endStep]` segment. The first
// decision in each segment supplies the justification surfaced via
// the `title` attribute on hover.
export function buildSegments(decisions: DecisionRecord[]): ModeSegment[] {
  if (!decisions || decisions.length === 0) return [];
  const sorted = [...decisions].sort((a, b) => a.step - b.step);
  const segments: ModeSegment[] = [];
  let current: ModeSegment | null = null;
  for (const d of sorted) {
    if (current === null || current.mode !== d.system_mode) {
      if (current !== null) segments.push(current);
      current = {
        mode: d.system_mode,
        startStep: d.step,
        endStep: d.step,
        justification: d.justification ?? "",
      };
    } else {
      current.endStep = d.step;
    }
  }
  if (current !== null) segments.push(current);
  return segments;
}

function formatRange(seg: ModeSegment): string {
  if (seg.startStep === seg.endStep) return `step ${seg.startStep}`;
  return `step ${seg.startStep}–${seg.endStep}`;
}

function segmentContains(seg: ModeSegment, step: number | undefined): boolean {
  if (step === undefined || step === null) return false;
  return step >= seg.startStep && step <= seg.endStep;
}

export function ModeTimeline({ decisions, currentStep }: ModeTimelineProps) {
  const segments = buildSegments(decisions);

  if (segments.length === 0) {
    return (
      <div
        role="status"
        data-testid="mode-timeline-empty"
        className="border border-dashed border-border rounded-md p-4 text-sm bg-surface/40"
      >
        <p className="font-mono uppercase tracking-wider text-text-muted text-xs">
          Run a step to see mode transitions
        </p>
      </div>
    );
  }

  return (
    <section
      data-testid="mode-timeline"
      aria-label="Mode transition timeline"
      className="bg-surface-elevated border border-border rounded-md p-4 space-y-3"
    >
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          {"// MODE TRANSITION TIMELINE"}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          {segments.length} {segments.length === 1 ? "SEGMENT" : "SEGMENTS"}
        </p>
      </header>
      <ol
        data-testid="mode-timeline-band"
        className="flex flex-col sm:flex-row sm:flex-wrap items-stretch gap-2"
      >
        {segments.map((seg, i) => {
          const active = segmentContains(seg, currentStep);
          const baseClass = modeSegmentClass(seg.mode);
          const ringClass = active ? "ring-2 ring-accent border-2" : "border";
          // `title` carries the long justification so hover reveals it
          // without forcing a tooltip dependency.
          const tooltip = seg.justification
            ? `${seg.mode} (${formatRange(seg)}) — ${seg.justification}`
            : `${seg.mode} (${formatRange(seg)})`;
          return (
            <li
              key={`${seg.mode}-${seg.startStep}-${i}`}
              data-testid="mode-timeline-segment"
              data-mode={seg.mode}
              data-start={seg.startStep}
              data-end={seg.endStep}
              data-active={active ? "true" : "false"}
              title={tooltip}
              className={`flex-1 min-w-0 sm:min-w-[120px] rounded-md px-3 py-2 ${baseClass} ${ringClass}`}
            >
              <p className="font-mono uppercase text-[11px] tracking-wider truncate">{seg.mode}</p>
              <p className="font-mono text-[10px] tracking-wide opacity-80 truncate">
                {formatRange(seg)}
              </p>
            </li>
          );
        })}
      </ol>
      {currentStep !== undefined && currentStep !== null && (
        <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          Cursor: step {currentStep}
        </p>
      )}
    </section>
  );
}
