export type SystemMode = "NORMAL" | "DEGRADED" | "SAFE_MODE" | "FAILED";
export type SensorStatus = "OK" | "DEGRADED" | "INVALID";
export type VoteOutcome = "CONSENSUS" | "SPLIT" | "INSUFFICIENT_DATA";
export type EventType =
  | "SENSOR"
  | "CONTROLLER"
  | "VOTE"
  | "FAULT"
  | "MODE_CHANGE"
  | "DECISION"
  | "STATE";
export type EventSeverity = "INFO" | "WARNING" | "CRITICAL";
export type FaultSeverity = "WARNING" | "CRITICAL";

export interface VehicleState {
  simulation_id: string;
  step: number;
  timestamp: number;
  position_x: number;
  position_y: number;
  altitude: number;
  velocity: number;
  heading: number;
  pitch: number;
  roll: number;
  system_mode: SystemMode;
  last_action: string | null;
}

export interface ControllerOutput {
  controller_id: string;
  step: number;
  action: string;
  confidence: number;
  reason_code: string;
  response_time_ms: number;
  valid: boolean;
}

export interface VoteResult {
  outcome: VoteOutcome;
  selected_action: string | null;
  agreeing_controllers: string[];
  rejected_controllers: string[];
  reason: string;
}

export interface SensorReading {
  reading_id: string;
  step: number;
  altitude: number;
  velocity: number;
  heading: number;
  pitch: number;
  roll: number;
  confidence: number;
  status: SensorStatus;
  fault_flags: string[];
}

export interface SystemDecision {
  step: number;
  final_action: string;
  system_mode: SystemMode;
  safe_mode_active: boolean;
  justification: string;
  trusted_controllers: string[];
  rejected_controllers: string[];
}

export interface SimulationEvent {
  event_id: string;
  step: number;
  timestamp: number;
  component: string;
  type: EventType;
  severity: EventSeverity;
  message: string;
  metadata: Record<string, unknown>;
}

export interface FaultRecord {
  fault_id: string;
  type: string;
  target: string;
  start_step: number;
  end_step: number | null;
  severity: FaultSeverity;
  metadata: Record<string, unknown>;
}

export interface CreateSimulationResponse {
  simulation_id: string;
  seed: number;
}

export interface StepResponse {
  step: number;
  sensor: SensorReading;
  controllers: ControllerOutput[];
  vote: VoteResult;
  decision: SystemDecision;
  state: VehicleState;
}

export interface TimelineEntry {
  step: number;
  state: VehicleState;
  sensor: SensorReading;
  controllers: ControllerOutput[];
  vote: VoteResult;
  decision: SystemDecision;
  events: SimulationEvent[];
}

export interface ScenarioFault {
  type: string;
  target: string;
  start_step: number;
  duration: number | null;
  severity: string;
  metadata: Record<string, unknown>;
}

export interface Scenario {
  name: string;
  description: string;
  expected_behavior: string;
  seed: number;
  steps: number;
  faults: ScenarioFault[];
  expected_final_modes: string[];
}

export interface ScenarioResult {
  scenario: string;
  simulation_id: string;
  steps_run: number;
  final_mode: SystemMode;
  final_action: string;
  fault_summary: FaultRecord[];
  decision_counts: Record<string, number>;
  event_counts: Record<string, number>;
  mode_transitions: { step: number; mode: string }[];
  trust_snapshot: Record<string, unknown>;
}

export interface ComponentTrustSnapshot {
  status: string;
  trust: number;
  fault_streak: number;
  clean_streak: number;
  repeat_count: number;
  disagreement_rate?: number;
}

export interface TrajectoryPoint {
  step: number;
  timestamp: number;
  position_x: number;
  position_y: number;
  altitude: number;
  system_mode: string;
}

export interface DecisionRecord {
  step: number;
  final_action: string;
  system_mode: SystemMode;
  safe_mode_active: boolean;
  justification: string;
  trusted_controllers: string[];
  rejected_controllers: string[];
}

export interface AnomalyVsDeterministicSummary {
  anomaly_alert_steps: number[];
  deterministic_alert_steps: number[];
  agreement_steps: number[];
  agreement_rate: number;
  average_anomaly_score: number;
}

export interface MissionReport {
  simulation_id: string;
  seed: number;
  total_steps: number;
  initial_state: VehicleState;
  final_state: VehicleState;
  final_system_mode: SystemMode;
  injected_faults: FaultRecord[];
  mode_transitions: { step: number; mode: string; justification?: string }[];
  controller_trust_summary: Record<string, ComponentTrustSnapshot>;
  sensor_health_summary: Record<string, ComponentTrustSnapshot>;
  vote_outcome_counts: Record<string, number>;
  rejected_controller_counts: Record<string, number>;
  critical_events: SimulationEvent[];
  risk_assessment: { level: string; summary: string };
  anomaly_vs_deterministic?: AnomalyVsDeterministicSummary;
}
