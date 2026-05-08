import { Card } from "./Card";

interface TrustEntry {
  status?: string;
  trust?: number;
  fault_streak?: number;
  clean_streak?: number;
}

interface GlobalTrust {
  disagreement_rate?: number;
}

type TrustSnapshot = Record<string, TrustEntry | GlobalTrust>;

export function TrustScorePanel({ snapshot }: { snapshot: TrustSnapshot }) {
  if (!snapshot) {
    return null;
  }
  const entries = Object.entries(snapshot).filter(([k]) => k !== "_global") as [
    string,
    TrustEntry,
  ][];
  const global = snapshot._global as GlobalTrust | undefined;
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
            <tr key={cid} className="border-t border-dg-border">
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
        <p className="text-xs text-gray-400 mt-2">disagreement rate: {global.disagreement_rate}</p>
      )}
    </Card>
  );
}
