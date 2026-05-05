"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import type {
  DecisionRecord,
  FaultRecord,
  MissionReport,
  Scenario,
  SimulationEvent,
  TimelineEntry,
  TrajectoryPoint,
  VehicleState,
} from "@/types/api";

// SWR fetchers — each one routes through the typed api client so the
// error contract stays consistent and the hook return shape mirrors
// the backend payload exactly. Per RESEARCH.md §7 the kernel produces
// evidence; these hooks read it.

const swrConfig = {
  revalidateOnFocus: false,
  shouldRetryOnError: false,
};

export function useSimulations() {
  return useSWR(
    "/simulations",
    () => api.listSimulations() as Promise<{ id: string; seed: number; created_at: number }[]>,
    swrConfig
  );
}

export function useSimulation(id: string | null) {
  return useSWR(
    id ? ["/simulations", id] : null,
    async () => {
      if (!id) throw new Error("missing id");
      return api.getSimulation(id);
    },
    swrConfig
  );
}

export function useSimulationState(id: string | null) {
  return useSWR<VehicleState | null>(
    id ? ["/simulations", id, "state"] : null,
    async () => {
      if (!id) return null;
      return api.getState(id);
    },
    swrConfig
  );
}

export function useTimeline(id: string | null) {
  return useSWR<TimelineEntry[] | null>(
    id ? ["/simulations", id, "timeline"] : null,
    async () => (id ? api.getTimeline(id) : null),
    swrConfig
  );
}

export function useTrajectory(id: string | null) {
  return useSWR<TrajectoryPoint[] | null>(
    id ? ["/simulations", id, "trajectory"] : null,
    async () => (id ? api.getTrajectory(id) : null),
    swrConfig
  );
}

export function useEvents(id: string | null) {
  return useSWR<SimulationEvent[] | null>(
    id ? ["/simulations", id, "events"] : null,
    async () => (id ? api.getEvents(id) : null),
    swrConfig
  );
}

export function useFaults(id: string | null) {
  return useSWR<FaultRecord[] | null>(
    id ? ["/simulations", id, "faults"] : null,
    async () => (id ? api.getFaults(id) : null),
    swrConfig
  );
}

export function useDecisions(id: string | null) {
  return useSWR<DecisionRecord[] | null>(
    id ? ["/simulations", id, "decisions"] : null,
    async () => (id ? api.getDecisions(id) : null),
    swrConfig
  );
}

export function useReport(id: string | null) {
  return useSWR<MissionReport | null>(
    id ? ["/simulations", id, "report"] : null,
    async () => (id ? api.getReport(id) : null),
    swrConfig
  );
}

export function useScenarios() {
  return useSWR<Scenario[]>("/scenarios", () => api.listScenarios(), swrConfig);
}

export function useTrajectoryEndpoint(id: string | null) {
  return useTrajectory(id);
}
