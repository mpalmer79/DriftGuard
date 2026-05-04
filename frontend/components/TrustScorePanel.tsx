import { Card } from "./Card";

export function TrustScorePanel({ snapshot }: { snapshot: Record<string, any> }) {
  if (!snapshot) {
    return null;
  }
  const entries = Object.entries(snapshot).filter(([k]) => k !== "_global");
  const global = snapshot._global;
  return (
    <Card title="Trust snapshot">
      <table className="w-full text-xs">
        <thead className="text-gray-400 text-left">
          <tr>
            <th className="py-1">component</th>
            <th>status</th>
            <th>trust</th>
            <th>fault streak</th>
            <th>clean streak</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([cid, h]) => (
            <tr key={cid} className="border-t border-sentinel-border">
              <td className="py-1">{cid}</td>
              <td>{h.status}</td>
              <td>{h.trust}</td>
              <td>{h.fault_streak}</td>
              <td>{h.clean_streak}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {global && (
        <p className="text-xs text-gray-400 mt-2">
          disagreement rate: {global.disagreement_rate}
        </p>
      )}
    </Card>
  );
}
