"use client";

import type { MissionReport } from "@/types/api";
import { SystemModeBadge } from "./SystemModeBadge";
import { DecisionsByModeBar, VoteOutcomeDonut } from "./charts/ReportCharts";
import { Button } from "./ui/Button";

interface Props {
  report: MissionReport;
  markdown: string;
  decisions?: { step: number; system_mode: string; final_action: string }[];
}

export function MissionReportView({ report, markdown, decisions = [] }: Props) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      // Clipboard rejects in non-secure contexts; ignore.
    }
  }

  function download() {
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.simulation_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    if (typeof window !== "undefined") window.print();
  }

  const cmp = report.anomaly_vs_deterministic ?? null;

  return (
    <div className="space-y-6 print:space-y-3">
      <section className="surface-elevated-grad border border-border rounded-md p-5 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">Mission report</h1>
          <SystemModeBadge mode={report.final_system_mode} />
          <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
            risk: <span className="text-text-primary">{report.risk_assessment.level}</span>
          </span>
          <div className="ml-auto flex gap-2 print:hidden">
            <Button variant="primary" size="sm" onClick={copy}>
              copy markdown
            </Button>
            <Button size="sm" onClick={download}>
              download json
            </Button>
            <Button size="sm" onClick={printReport}>
              print
            </Button>
          </div>
        </div>
        <p className="text-sm text-text-muted leading-relaxed">{report.risk_assessment.summary}</p>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm pt-2 border-t border-border">
          <Row k="seed" v={report.seed} />
          <Row k="steps" v={report.total_steps} />
          <Row k="final mode" v={report.final_system_mode} />
          <Row k="simulation_id" v={report.simulation_id.slice(0, 12) + "…"} />
        </dl>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <VoteOutcomeDonut counts={report.vote_outcome_counts ?? {}} />
        <DecisionsByModeBar decisions={decisions} />
      </div>

      {cmp && (
        <section className="surface-elevated-grad border border-border rounded-md p-4 space-y-2">
          <h2 className="font-mono uppercase text-sm tracking-wider text-text-primary">
            Anomaly detector vs deterministic
          </h2>
          <p className="text-sm text-text-primary">
            ML alerted on {cmp.anomaly_alert_steps?.length ?? 0} step(s); deterministic alerted on{" "}
            {cmp.deterministic_alert_steps?.length ?? 0} step(s).
          </p>
          <p className="text-sm text-text-muted">
            Agreement on {cmp.agreement_steps?.length ?? 0} step(s) (rate {cmp.agreement_rate ?? 0}
            ). Average score {cmp.average_anomaly_score ?? 0}.
          </p>
          <p className="text-xs text-text-muted">
            The anomaly detector is advisory only (ADR 0009); these numbers describe agreement, not
            control.
          </p>
        </section>
      )}

      <section className="surface-elevated-grad border border-border rounded-md p-4 space-y-2">
        <h2 className="font-mono uppercase text-sm tracking-wider text-text-primary">
          Mode transitions
        </h2>
        {report.mode_transitions.length === 0 ? (
          <p className="font-mono text-xs text-text-muted">No transitions.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {report.mode_transitions.map((t, i) => (
              <li key={i} className="flex gap-3 font-mono">
                <span className="text-text-muted w-16 shrink-0">step {t.step}</span>
                <span className="text-text-primary font-medium w-24 shrink-0">{t.mode}</span>
                <span className="text-text-muted">{t.justification}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="surface-elevated-grad border border-border rounded-md group print:open">
        <summary className="cursor-pointer p-4 flex items-center justify-between gap-3 flex-wrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
          <span className="font-mono uppercase text-sm tracking-wider text-text-primary">
            Markdown
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            raw export
          </span>
        </summary>
        <pre className="text-xs whitespace-pre-wrap overflow-x-auto opacity-90 px-4 pb-4 font-mono text-text-primary">
          {markdown}
        </pre>
      </details>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="flex justify-between gap-2 font-mono text-xs">
      <dt className="text-text-muted uppercase tracking-wider">{k}</dt>
      <dd className="text-text-primary truncate">{String(v)}</dd>
    </div>
  );
}
