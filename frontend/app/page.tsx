import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <header className="space-y-3 max-w-3xl">
        <h1 className="text-3xl font-semibold">DriftGuard</h1>
        <p className="text-gray-300 leading-relaxed">
          A deterministic, fault-tolerant control system simulation. Three redundant controllers
          process noisy sensor data, vote by majority, and escalate through{" "}
          <code className="text-sentinel-accent">NORMAL</code>
          {" → "}
          <code>DEGRADED</code>
          {" → "}
          <code>SAFE_MODE</code>
          {" → "}
          <code className="text-sentinel-bad">FAILED</code> as fault detection erodes trust. Every
          decision is reproducible from a seed, and every step is logged for audit.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/dashboard"
          className="bg-sentinel-panel border border-sentinel-border rounded-lg p-5 hover:border-sentinel-accent transition"
        >
          <h2 className="font-semibold mb-1">Dashboard</h2>
          <p className="text-sm text-gray-400">
            Create a simulation, run steps, inject faults, watch state.
          </p>
        </Link>
        <Link
          href="/scenarios"
          className="bg-sentinel-panel border border-sentinel-border rounded-lg p-5 hover:border-sentinel-accent transition"
        >
          <h2 className="font-semibold mb-1">Scenarios</h2>
          <p className="text-sm text-gray-400">
            Run named mission profiles: nominal cruise, sensor drift, split vote escalation,
            multi-fault failure, intermittent fault.
          </p>
        </Link>
        <a
          href="https://github.com/mpalmer79/SentinelNav"
          target="_blank"
          rel="noreferrer"
          className="bg-sentinel-panel border border-sentinel-border rounded-lg p-5 hover:border-sentinel-accent transition"
        >
          <h2 className="font-semibold mb-1">Source</h2>
          <p className="text-sm text-gray-400">
            Backend (FastAPI), simulation core (Python), persistence (SQLite), and this frontend
            (Next.js + TypeScript).
          </p>
        </a>
      </section>

      <section className="prose prose-invert max-w-none text-sm leading-relaxed text-gray-300">
        <h2 className="text-lg font-semibold">Why this exists</h2>
        <p>
          Aerospace, defense, automotive, and medical systems frequently rely on triple-redundant
          controllers with majority voting and explicit safe-mode behavior. DriftGuard models that
          pattern in a clean, inspectable way. It is not a flight simulator — it is a small,
          deterministic test bed for fault handling, recovery, and audit.
        </p>
      </section>
    </div>
  );
}
