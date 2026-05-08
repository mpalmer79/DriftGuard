import type { ControllerOutput } from "@/types/api";
import { Card } from "./Card";

export function ControllerOutputTable({ outputs }: { outputs: ControllerOutput[] }) {
  if (!outputs || outputs.length === 0) {
    return (
      <Card title="Controller outputs">
        <p className="text-gray-500 text-sm">No controller outputs.</p>
      </Card>
    );
  }
  return (
    <Card title="Controller outputs">
      <table className="w-full text-xs">
        <thead className="text-gray-400">
          <tr className="text-left">
            <th className="py-1">id</th>
            <th>action</th>
            <th>conf</th>
            <th>reason</th>
            <th>rt(ms)</th>
            <th>valid</th>
          </tr>
        </thead>
        <tbody>
          {outputs.map((o) => (
            <tr key={o.controller_id} className="border-t border-dg-border">
              <td className="py-1">{o.controller_id}</td>
              <td>{o.action}</td>
              <td>{(o.confidence ?? 0).toFixed(2)}</td>
              <td className="opacity-80">{o.reason_code}</td>
              <td>{o.response_time_ms}</td>
              <td className={o.valid ? "text-dg-good" : "text-dg-bad"}>{o.valid ? "yes" : "no"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
