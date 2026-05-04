"use client";

import type { MissionReport } from "@/types/api";
import { Card } from "./Card";
import { SystemModeBadge } from "./SystemModeBadge";

export function MissionReportView({
  report,
  markdown,
}: {
  report: MissionReport;
  markdown: string;
}) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      alert("Markdown copied to clipboard.");
    } catch {
      alert("Could not copy. Use the download button instead.");
    }
  }

  function download() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.simulation_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold">Mission report</h1>
          <SystemModeBadge mode={report.final_system_mode} />
          <span className="text-sm text-gray-400">
            risk: <span className="text-white">{report.risk_assessment.level}</span>
          </span>
          <div className="ml-auto flex gap-2 text-xs">
            <button onClick={copy} className="px-3 py-1 border border-sentinel-accent/40 bg-sentinel-accent/20 rounded">
              copy markdown
            </button>
            <button onClick={download} className="px-3 py-1 border border-sentinel-border rounded">
              download json
            </button>
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
        <pre className="text-xs whitespace-pre-wrap overflow-x-auto opacity-90">
          {markdown}
        </pre>
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
