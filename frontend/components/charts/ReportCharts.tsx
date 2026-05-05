"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/Card";

const VOTE_COLORS: Record<string, string> = {
  CONSENSUS: "#22c55e",
  SPLIT: "#f59e0b",
  INSUFFICIENT_DATA: "#ef4444",
};

const MODE_COLORS: Record<string, string> = {
  NORMAL: "#22c55e",
  DEGRADED: "#f59e0b",
  SAFE_MODE: "#ef4444",
  FAILED: "#b91c1c",
};

interface VoteOutcomeDonutProps {
  counts: Record<string, number>;
}

export function VoteOutcomeDonut({ counts }: VoteOutcomeDonutProps) {
  const data = Object.entries(counts).map(([name, value]) => ({ name, value }));
  if (!data.length) {
    return null;
  }
  return (
    <Card title="Vote outcomes">
      <div className="h-48" role="img" aria-label="Vote outcome distribution">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={40}
              outerRadius={70}
              paddingAngle={2}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={VOTE_COLORS[d.name] ?? "#9ca3af"} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "#111827",
                border: "1px solid #1f2937",
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

interface DecisionsByModeBarProps {
  decisions: { step: number; system_mode: string; final_action: string }[];
}

export function DecisionsByModeBar({ decisions }: DecisionsByModeBarProps) {
  if (!decisions || decisions.length === 0) {
    return null;
  }
  // Stacked bar: one column per action, stacked by mode.
  const byActionByMode: Record<string, Record<string, number>> = {};
  for (const d of decisions) {
    byActionByMode[d.final_action] ??= {};
    byActionByMode[d.final_action][d.system_mode] =
      (byActionByMode[d.final_action][d.system_mode] ?? 0) + 1;
  }
  const modes = Array.from(new Set(decisions.map((d) => d.system_mode))).sort();
  const data = Object.entries(byActionByMode).map(([action, modeCounts]) => ({
    action,
    ...modeCounts,
  }));
  return (
    <Card title="Decisions per action × mode">
      <div className="h-48" role="img" aria-label="Decisions stacked by mode">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis dataKey="action" stroke="#9ca3af" tick={{ fontSize: 10 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "#111827",
                border: "1px solid #1f2937",
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {modes.map((mode) => (
              <Bar
                key={mode}
                dataKey={mode}
                stackId="m"
                fill={MODE_COLORS[mode] ?? "#9ca3af"}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

interface TrustSparklineProps {
  trustByStep: { step: number; values: Record<string, number> }[];
}

/**
 * Small line chart showing per-controller trust over time. Caller
 * is responsible for assembling the per-step trust map; today the
 * report exposes a final snapshot only, so this component renders
 * a one-bar fallback unless the timeline carries trust events.
 */
export function TrustSparkline({ trustByStep }: TrustSparklineProps) {
  if (!trustByStep || trustByStep.length === 0) {
    return null;
  }
  const controllers = Array.from(new Set(trustByStep.flatMap((s) => Object.keys(s.values)))).sort();
  const data = trustByStep.map((s) => ({ step: s.step, ...s.values }));

  return (
    <Card title="Controller trust over time">
      <div className="h-32" role="img" aria-label="Per-controller trust sparkline">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis dataKey="step" stroke="#9ca3af" tick={{ fontSize: 10 }} />
            <YAxis stroke="#9ca3af" domain={[0, 1]} tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: "#111827",
                border: "1px solid #1f2937",
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {controllers.map((cid, i) => (
              <Line
                key={cid}
                type="monotone"
                dataKey={cid}
                stroke={["#38bdf8", "#22c55e", "#f59e0b"][i % 3]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
