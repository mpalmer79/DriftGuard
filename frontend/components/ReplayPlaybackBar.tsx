// ReplayPlaybackBar — presentational playback controls (play/pause, step,
// scrubber, speed) for a replay timeline. Reads state from a ReplayClockHandle
// and dispatches actions through it; holds no local state mirror.

"use client";

import type { JSX, KeyboardEvent } from "react";

import type { ReplayClockHandle, Speed } from "@/lib/hooks/useReplayClock";
import type { SystemMode } from "@/types/api";

export interface ReplayPlaybackBarProps {
  clock: ReplayClockHandle;
  totalSteps: number;
  modeAtStep: (step: number) => SystemMode | null;
  className?: string;
}

// Static lookup so Tailwind's content scanner can see every class string
// at build time. Dynamic `bg-${token}` strings get tree-shaken.
const SEGMENT_CLASS: Record<SystemMode, string> = {
  NORMAL: "bg-status-nominal/40 hover:bg-status-nominal/60",
  DEGRADED: "bg-status-degraded/40 hover:bg-status-degraded/60",
  SAFE_MODE: "bg-status-safemode/40 hover:bg-status-safemode/60",
  FAILED: "bg-status-failed/40 hover:bg-status-failed/60",
};

const FALLBACK_SEGMENT_CLASS = "bg-border/60 hover:bg-border";

function segmentClass(mode: SystemMode | null): string {
  if (mode === null) return FALLBACK_SEGMENT_CLASS;
  return SEGMENT_CLASS[mode] ?? FALLBACK_SEGMENT_CLASS;
}

interface SpeedOption {
  value: Speed;
  label: string;
}

const SPEED_OPTIONS: readonly SpeedOption[] = [
  { value: 0.5, label: "0.5×" },
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
  { value: 4, label: "4×" },
];

const FOCUS_RING_CLASS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

const ICON_BUTTON_CLASS =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded border border-border text-text-primary transition-colors hover:border-accent/60 hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed";

function PlayIcon(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      className="fill-current"
    >
      <path d="M7 5v14l12-7z" />
    </svg>
  );
}

function PauseIcon(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      className="fill-current"
    >
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function StepBackIcon(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      className="fill-current"
    >
      <rect x="5" y="5" width="2" height="14" rx="1" />
      <path d="M19 5v14L9 12z" />
    </svg>
  );
}

function StepForwardIcon(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      className="fill-current"
    >
      <path d="M5 5v14l10-7z" />
      <rect x="17" y="5" width="2" height="14" rx="1" />
    </svg>
  );
}

export function ReplayPlaybackBar(props: ReplayPlaybackBarProps): JSX.Element {
  const { clock, totalSteps, modeAtStep, className } = props;

  const hasSteps = totalSteps > 0;
  const playable = totalSteps >= 2;
  const lastIndex = hasSteps ? totalSteps - 1 : 0;
  const atStart = !hasSteps || clock.currentStep <= 0;
  const atEnd = !hasSteps || clock.currentStep >= lastIndex;

  const counterCurrent = hasSteps ? clock.currentStep + 1 : 0;
  const playLabel = clock.isPlaying ? "Pause replay" : "Play replay";

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    switch (event.key) {
      case " ":
      case "k": {
        event.preventDefault();
        clock.toggle();
        return;
      }
      case "ArrowRight": {
        event.preventDefault();
        clock.stepForward();
        return;
      }
      case "ArrowLeft": {
        event.preventDefault();
        clock.stepBackward();
        return;
      }
      case "1": {
        clock.setSpeed(0.5);
        return;
      }
      case "2": {
        clock.setSpeed(1);
        return;
      }
      case "3": {
        clock.setSpeed(2);
        return;
      }
      case "4": {
        clock.setSpeed(4);
        return;
      }
      default:
        return;
    }
  }

  const rootClass = [
    "flex flex-wrap items-center gap-3 sm:gap-4 px-4 py-3 bg-surface-elevated border border-border rounded-md",
    FOCUS_RING_CLASS,
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      data-testid="replay-playback-bar"
      role="group"
      aria-label="Replay playback controls"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={rootClass}
    >
      <button
        type="button"
        aria-label={playLabel}
        aria-pressed={clock.isPlaying}
        onClick={() => clock.toggle()}
        disabled={!playable}
        className={`${ICON_BUTTON_CLASS} ${FOCUS_RING_CLASS}`}
      >
        {clock.isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      <button
        type="button"
        aria-label="Step backward"
        onClick={() => clock.stepBackward()}
        disabled={!hasSteps || atStart}
        className={`${ICON_BUTTON_CLASS} ${FOCUS_RING_CLASS}`}
      >
        <StepBackIcon />
      </button>

      <span
        data-testid="replay-step-counter"
        className="font-mono text-xs uppercase tracking-wider text-text-primary whitespace-nowrap"
      >
        STEP {counterCurrent} / {totalSteps}
      </span>

      <button
        type="button"
        aria-label="Step forward"
        onClick={() => clock.stepForward()}
        disabled={!hasSteps || atEnd}
        className={`${ICON_BUTTON_CLASS} ${FOCUS_RING_CLASS}`}
      >
        <StepForwardIcon />
      </button>

      {hasSteps ? (
        <div
          role="group"
          aria-label="Step scrubber"
          data-testid="replay-scrubber"
          className={`flex min-w-0 flex-1 items-stretch gap-0.5 ${
            playable ? "" : "opacity-50 cursor-not-allowed pointer-events-none"
          }`}
        >
          {Array.from({ length: totalSteps }, (_unused, step) => {
            const mode = modeAtStep(step);
            const isCurrent = step === clock.currentStep;
            const baseClass = segmentClass(mode);
            const ringClass = isCurrent ? "ring-2 ring-accent z-10" : "";
            return (
              <button
                key={step}
                type="button"
                aria-label={`Jump to step ${step}`}
                aria-current={isCurrent ? "step" : undefined}
                data-testid="replay-scrubber-segment"
                data-step={step}
                onClick={() => clock.jumpTo(step)}
                disabled={!playable}
                className={`h-4 min-w-0 flex-1 rounded-sm transition-colors ${baseClass} ${ringClass} ${FOCUS_RING_CLASS}`}
              />
            );
          })}
        </div>
      ) : (
        <div
          role="group"
          aria-label="Step scrubber"
          data-testid="replay-scrubber-empty"
          aria-disabled="true"
          className="flex min-w-0 flex-1 h-4 rounded-sm bg-border/60 opacity-50 cursor-not-allowed pointer-events-none"
        />
      )}

      <div role="group" aria-label="Playback speed" className="flex items-center gap-1.5 flex-wrap">
        {SPEED_OPTIONS.map((opt) => {
          const active = clock.speedMultiplier === opt.value;
          const stateClass = active
            ? "border-accent text-accent"
            : "border-border text-text-muted hover:border-accent/60 hover:text-accent";
          return (
            <button
              key={opt.value}
              type="button"
              aria-label={`Set speed to ${opt.label}`}
              aria-pressed={active}
              onClick={() => clock.setSpeed(opt.value)}
              className={`px-2 py-1 rounded-full border font-mono text-[10px] uppercase tracking-wider transition-colors ${stateClass} ${FOCUS_RING_CLASS}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {clock.isComplete ? (
        <span
          data-testid="replay-at-end-badge"
          className="font-mono uppercase text-[10px] tracking-wider text-status-safemode border border-status-safemode/40 bg-status-safemode/10 px-2 py-0.5 rounded"
        >
          AT END
        </span>
      ) : null}
    </div>
  );
}
