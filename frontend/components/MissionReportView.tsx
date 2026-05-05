"use client";

import type { MissionReport } from "@/types/api";
import { Card } from "./Card";
import { SystemModeBadge } from "./SystemModeBadge";
import {
  DecisionsByModeBar,
  VoteOutcomeDonut,
} from "./charts/ReportCharts";
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
      // Surfaced through the browser's permission prompt; we don't
      // alert() so the print stylesheet stays clean.
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

  const cmp = (report as any).anomaly_vs_deterministic ?? null;

  return (
    <div className="space-y-6 print:space-y-3">
      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold">Mission report</h1>
          <SystemModeBadge mode={report.final_system_mode} />
          <span className="text-sm text-gray-400">
            risk: <span className="text-white">{report.risk_assessment.level}</span>
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
        <p className="text-xs text-gray-400 mt-2">{report.risk_assessment.summary}</p>
      </Card>

      <Card title="Summary">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <Row k="simulation_id" v={report.simulation_id} />
          <Row k="seed" v={report.seed} />
          <Row k="steps" v={report.total_steps} />
          <Row k="final mode" v={report.final_system_mode} />
        </dl>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <VoteOutcomeDonut counts={report.vote_outcome_counts ?? {}} />
        <DecisionsByModeBar decisions={decisions} />
      </div>

      {cmp && (
        <Card title="Anomaly detector vs deterministic system">
          <p className="text-sm">
            ML alerted on {cmp.anomaly_alert_steps?.length ?? 0} step(s);
            deterministic alerted on {cmp.deterministic_alert_steps?.length ?? 0} step(s).
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Agreement on {cmp.agreement_steps?.length ?? 0} step(s) (rate{" "}
            {cmp.agreement_rate ?? 0}). Average score{" "}
            {cmp.average_anomaly_score ?? 0}.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            The anomaly detector is advisory only (ADR 0009); these
            numbers describe agreement, not control.
          </p>
        </Card>
      )}

      <Card title="Mode transitions">
        {report.mode_transitions.length === 0 ? (
          <p className="text-sm text-gray-500">No transitions.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {report.mode_transitions.map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-gray-500 w-16">step {t.step}</span>
                <span className="font-medium">{t.mode}</span>
                <span className="text-gray-400">{t.justification}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Markdown">
        <pre className="text-xs whitespace-pre-wrap overflow-x-auto opacity-90">{markdown}</pre>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-400">{k}</dt>
      <dd>{String(v)}</dd>
    </div>
  );
}
