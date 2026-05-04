import type {
  CreateSimulationResponse,
  FaultRecord,
  MissionReport,
  Scenario,
  ScenarioResult,
  SimulationEvent,
  StepResponse,
  TimelineEntry,
  VehicleState,
} from "@/types/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

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
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      ...init,
    });
  } catch (err) {
    throw new ApiError(0, null, `cannot reach SentinelNav backend at ${API_BASE}: ${(err as Error).message}`);
  }

  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) {
    const msg =
      (body as any)?.error?.message ||
      (body as any)?.detail ||
      `request failed with status ${res.status}`;
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

  listSimulations: () => request<{ id: string; seed: number; created_at: number }[]>("/simulations"),

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
      simulation: any;
      latest_state: VehicleState | null;
      step_count: number;
      faults: FaultRecord[];
      in_memory: boolean;
    }>(`/simulations/${id}`),

  getState: (id: string) => request<VehicleState>(`/simulations/${id}/state`),

  getEvents: (id: string) => request<SimulationEvent[]>(`/simulations/${id}/events`),

  getDecisions: (id: string) => request<any[]>(`/simulations/${id}/decisions`),

  getFaults: (id: string) => request<FaultRecord[]>(`/simulations/${id}/faults`),

  getTimeline: (id: string) => request<TimelineEntry[]>(`/simulations/${id}/timeline`),

  listScenarios: () => request<Scenario[]>("/scenarios"),

  getScenario: (name: string) => request<Scenario>(`/scenarios/${name}`),

  runScenario: (name: string, steps?: number) => {
    const path = steps ? `/scenarios/${name}/run/${steps}` : `/scenarios/${name}/run`;
    return request<ScenarioResult>(path, { method: "POST" });
  },

  getReport: (id: string) => request<MissionReport>(`/simulations/${id}/report`),

  getMarkdownReport: (id: string) => requestText(`/simulations/${id}/report/markdown`),
};

export type { ApiError };
