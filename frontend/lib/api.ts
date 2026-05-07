import type {
  CreateSimulationResponse,
  DecisionRecord,
  FaultRecord,
  MissionReport,
  Scenario,
  ScenarioResult,
  SimulationEvent,
  StepResponse,
  TimelineEntry,
  TrajectoryPoint,
  VehicleState,
} from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

// Phase 6.3: state-mutating calls go through the same-origin
// `/api/proxy/<path>` handler so the bearer token can be injected
// server-side. Reads stay on the public NEXT_PUBLIC_API_BASE — they
// don't need the token and adding a hop would just slow them down.
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function targetFor(path: string, method: string): string {
  if (WRITE_METHODS.has(method.toUpperCase())) {
    return `/api/proxy${path}`;
  }
  return `${API_BASE}${path}`;
}

class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const url = targetFor(path, method);
  let res: Response;
  try {
    res = await fetch(url, {
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      ...init,
    });
  } catch (err) {
    throw new ApiError(
      0,
      null,
      `cannot reach DriftGuard backend at ${API_BASE}: ${(err as Error).message}`
    );
  }

  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) {
    const errBody = (body ?? {}) as {
      error?: { message?: string };
      detail?: string;
    };
    const msg =
      errBody.error?.message || errBody.detail || `request failed with status ${res.status}`;
    throw new ApiError(res.status, body, msg);
  }
  return body as T;
}

async function requestText(path: string): Promise<string> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new ApiError(res.status, null, `failed to fetch ${path}`);
  }
  return res.text();
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  base: API_BASE,
  ApiError,

  health: () => request<{ status: string }>("/health"),

  listSimulations: () =>
    request<{ id: string; seed: number; created_at: number }[]>("/simulations"),

  createSimulation: (seed?: number) =>
    request<CreateSimulationResponse>("/simulations", {
      method: "POST",
      body: JSON.stringify(seed !== undefined ? { seed } : {}),
    }),

  stepSimulation: (id: string) =>
    request<StepResponse>(`/simulations/${id}/step`, { method: "POST" }),

  injectFault: (id: string, payload: Record<string, unknown>) =>
    request<FaultRecord>(`/simulations/${id}/faults`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getSimulation: (id: string) =>
    request<{
      simulation: { id: string; seed: number; created_at: number } | null;
      latest_state: VehicleState | null;
      step_count: number;
      faults: FaultRecord[];
      in_memory: boolean;
    }>(`/simulations/${id}`),

  getState: (id: string) => request<VehicleState>(`/simulations/${id}/state`),

  getEvents: (id: string) => request<SimulationEvent[]>(`/simulations/${id}/events`),

  getDecisions: (id: string) => request<DecisionRecord[]>(`/simulations/${id}/decisions`),

  getFaults: (id: string) => request<FaultRecord[]>(`/simulations/${id}/faults`),

  getTimeline: (id: string) => request<TimelineEntry[]>(`/simulations/${id}/timeline`),

  getTrajectory: (id: string) => request<TrajectoryPoint[]>(`/simulations/${id}/trajectory`),

  streamUrl: (id: string, steps: number, speed: number) =>
    `${API_BASE}/simulations/${id}/stream?steps=${steps}&speed=${speed}`,

  listScenarios: () => request<Scenario[]>("/scenarios"),

  getScenario: (name: string) => request<Scenario>(`/scenarios/${name}`),

  runScenario: (name: string, steps?: number, overrides?: Record<string, unknown>) => {
    const path = steps ? `/scenarios/${name}/run/${steps}` : `/scenarios/${name}/run`;
    return request<ScenarioResult>(path, {
      method: "POST",
      body: overrides ? JSON.stringify(overrides) : undefined,
    });
  },

  createScenario: async (yamlBody: string) => {
    // YAML upload — content-type is preserved by the proxy
    // (Phase 6.3) so the FastAPI parse_yaml branch still fires.
    const res = await fetch(targetFor("/scenarios", "POST"), {
      method: "POST",
      headers: { "Content-Type": "text/yaml" },
      body: yamlBody,
      cache: "no-store",
    });
    const text = await res.text();
    const body = text ? safeJson(text) : null;
    if (!res.ok) {
      const detail = ((body ?? {}) as { detail?: unknown }).detail;
      throw new ApiError(
        res.status,
        body,
        detail !== undefined ? `validation: ${JSON.stringify(detail)}` : `failed: ${res.status}`
      );
    }
    return body as Scenario;
  },

  deleteScenario: (name: string) => request<void>(`/scenarios/${name}`, { method: "DELETE" }),

  getReport: (id: string) => request<MissionReport>(`/simulations/${id}/report`),

  getMarkdownReport: (id: string) => requestText(`/simulations/${id}/report/markdown`),
};

export type { ApiError };
