import type { Scenario, SystemMode } from "@/types/api";

interface ScenarioNarrativeProps {
  scenario: Scenario;
}

const MODE_CHIP_CLASS: Record<SystemMode, string> = {
  NORMAL: "text-status-nominal border-status-nominal/40 bg-status-nominal/10",
  DEGRADED: "text-status-degraded border-status-degraded/40 bg-status-degraded/10",
  SAFE_MODE: "text-status-safemode border-status-safemode/40 bg-status-safemode/10",
  FAILED: "text-status-failed border-status-failed/40 bg-status-failed/10",
};

const KNOWN_MODES = new Set<SystemMode>(["NORMAL", "DEGRADED", "SAFE_MODE", "FAILED"]);

function modeChipClass(mode: string): string {
  if (KNOWN_MODES.has(mode as SystemMode)) return MODE_CHIP_CLASS[mode as SystemMode];
  return "text-text-muted border-border bg-surface";
}

// First-fault target drives the post-run inspection checklist.
function inspectChecklist(scenario: Scenario): string[] {
  const firstFault = scenario.faults[0];
  if (!firstFault) {
    return [
      "Open the simulation detail page and inspect the decisions table.",
      "Check the mode timeline for any unexpected transitions.",
      "Confirm replay fingerprint is stable across re-runs.",
    ];
  }
  const target = (firstFault.target ?? "").toLowerCase();
  const start = firstFault.start_step ?? 0;
  if (target.startsWith("sensor")) {
    return [
      "Look at fault_flags on the sensor reading; expect non-empty entries during the fault window.",
      `Confirm DEGRADED enters by step ${start + 5}, or earlier if the magnitude is large.`,
      "Confirm RECOVERING then NORMAL after the fault clears.",
    ];
  }
  if (target.startsWith("controller_")) {
    return [
      `Look at the rejected_controllers list for ${target}; expect it to appear during the fault window.`,
      `Inspect the trust snapshot for ${target} after the run.`,
      "Confirm vote outcome is SPLIT or CONSENSUS-without-this-controller during the fault window.",
    ];
  }
  if (target.startsWith("gps")) {
    return [
      "Confirm system enters DEGRADED on signal loss.",
      "Check INS-only navigation continues — vehicle state should still update.",
      "Confirm SAFE_MODE if denial duration exceeds the budget.",
    ];
  }
  return [
    "Inspect the decisions table justification column step by step.",
    "Cross-reference active_fault_ids against the faults timeline.",
    "Confirm the final mode falls inside the expected envelope.",
  ];
}

function formatScenarioName(name: string): string {
  return name
    .split(/[-_]/)
    .map((part) => (part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join(" ");
}

function FaultChip({
  type,
  target,
  windowLabel,
}: {
  type: string;
  target: string;
  windowLabel: string;
}) {
  return (
    <span
      data-testid="fault-chip"
      className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-2.5 py-1 rounded-md border border-status-degraded/40 bg-status-degraded/10 text-status-degraded font-mono text-[11px]"
    >
      <span className="uppercase tracking-wider">{type}</span>
      <span className="opacity-60">→</span>
      <span className="uppercase tracking-wider">{target}</span>
      <span className="opacity-70 normal-case">{windowLabel}</span>
    </span>
  );
}

function ModeChip({ mode }: { mode: string }) {
  return (
    <span
      data-testid="mode-chip"
      className={`inline-flex items-center px-2.5 py-1 rounded-md border font-mono uppercase text-[11px] tracking-wider ${modeChipClass(mode)}`}
    >
      {mode}
    </span>
  );
}

export function ScenarioNarrative({ scenario }: ScenarioNarrativeProps) {
  const checklist = inspectChecklist(scenario);
  const expectedModes = scenario.expected_final_modes ?? [];

  return (
    <article
      aria-label={`Scenario narrative for ${scenario.name}`}
      data-testid="scenario-narrative"
      className="bg-surface-elevated border border-border rounded-md p-5 sm:p-6 space-y-6"
    >
      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
          {"// SCENARIO BRIEF"}
        </p>
        <h2 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight break-words">
          {formatScenarioName(scenario.name)}
        </h2>
        <p className="font-mono text-xs uppercase tracking-wide text-text-muted">
          SEED {scenario.seed}
          <span className="opacity-50 px-2">/</span>
          {scenario.steps} STEPS
          <span className="opacity-50 px-2">/</span>
          {scenario.faults.length} {scenario.faults.length === 1 ? "FAULT" : "FAULTS"}
        </p>
      </header>

      <section className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          What this scenario tests
        </p>
        <p className="text-sm text-text-primary leading-relaxed">{scenario.description}</p>
      </section>

      <section className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          Injected condition
        </p>
        {scenario.faults.length === 0 ? (
          <p className="font-mono text-xs text-text-muted">
            No faults injected — baseline / nominal scenario.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {scenario.faults.map((fault, i) => {
              const start = fault.start_step ?? 0;
              const windowLabel =
                fault.duration === null || fault.duration === undefined
                  ? `step ${start} → end`
                  : `step ${start} → ${start + fault.duration}`;
              return (
                <FaultChip
                  key={`${fault.type}-${fault.target}-${i}`}
                  type={fault.type}
                  target={fault.target}
                  windowLabel={windowLabel}
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          Expected operator observation
        </p>
        <blockquote className="border-l-2 border-accent/40 bg-surface/40 rounded-r-md pl-3 py-2 -ml-1">
          <p className="text-sm text-text-primary leading-relaxed">{scenario.expected_behavior}</p>
        </blockquote>
      </section>

      <section className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          Expected escalation
        </p>
        {expectedModes.length === 0 ? (
          <p className="font-mono text-xs text-text-muted">
            No expected escalation envelope declared.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {expectedModes.map((mode, i) => (
              <span key={`${mode}-${i}`} className="inline-flex items-center gap-2">
                {i > 0 && (
                  <span className="font-mono text-text-muted text-xs" aria-hidden>
                    →
                  </span>
                )}
                <ModeChip mode={mode} />
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          What to inspect after execution
        </p>
        <ol className="list-decimal list-inside space-y-1 text-sm text-text-primary leading-relaxed">
          {checklist.map((line, i) => (
            <li key={i} className="break-words">
              {line}
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
