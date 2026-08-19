export type LaneId = "N" | "E" | "S" | "W";

export const LANES: LaneId[] = ["N", "E", "S", "W"];

export const LANE_NAMES: Record<LaneId, string> = {
  N: "North Approach",
  E: "East Approach",
  S: "South Approach",
  W: "West Approach",
};

export type VehicleType = "car" | "bus" | "truck" | "motorcycle" | "ambulance" | "fire_truck";

export const EMERGENCY_TYPES: VehicleType[] = ["ambulance", "fire_truck"];

export type DensityLevel = "Low" | "Medium" | "High" | "Critical";

export type SignalColor = "red" | "amber" | "green";

export interface Vehicle {
  id: number;
  lane: LaneId;
  type: VehicleType;
  confidence: number;
  /** 0 = entering frame, 1 = at stop line */
  pos: number;
  speed: number;
  /** seconds spent stopped in queue */
  waited: number;
  lateral: number;
}

export interface LaneState {
  id: LaneId;
  name: string;
  count: number;
  queue: number;
  density: number; // 0..1
  level: DensityLevel;
  signal: SignalColor;
  greenDuration: number;
  countdown: number;
  avgWait: number;
  arrivalRate: number; // veh/min
  departed: number;
  predictedLevel: DensityLevel;
  predictedChangePct: number;
  recommendedGreen: number;
}

export interface HistorySample {
  t: number;
  clock: string;
  volume: number;
  avgWaitAi: number;
  avgWaitFixed: number;
  queue: number;
  density: number;
  N: number;
  E: number;
  S: number;
  W: number;
}

export interface EmergencyEvent {
  id: number;
  lane: LaneId;
  type: VehicleType;
  at: string;
  clearedSec: number | null;
}

export interface TrafficConfig {
  intersectionId: string;
  minGreen: number;
  maxGreen: number;
  amber: number;
  aiEnabled: boolean;
  emergencyPriority: boolean;
  demandMultiplier: number;
  speed: number;
  detectionConfidence: number;
}

export interface Intersection {
  id: string;
  name: string;
  location: string;
  lanes: number;
  active: boolean;
}

export interface TrafficSnapshot {
  simTime: number;
  clock: string;
  running: boolean;
  config: TrafficConfig;
  lanes: LaneState[];
  vehicles: Vehicle[];
  activeLane: LaneId;
  phase: "green" | "amber";
  countdown: number;
  totalDetected: number;
  totalQueue: number;
  avgWaitAi: number;
  avgWaitFixed: number;
  throughputAi: number;
  throughputFixed: number;
  history: HistorySample[];
  emergency: { active: boolean; lane: LaneId | null; type: VehicleType | null; secondsLeft: number };
  emergencyLog: EmergencyEvent[];
  intersections: Intersection[];
  policyWeights: Record<LaneId, number>;
}

export function densityLevel(d: number): DensityLevel {
  if (d >= 0.8) return "Critical";
  if (d >= 0.55) return "High";
  if (d >= 0.3) return "Medium";
  return "Low";
}

export const LEVEL_TOKEN: Record<DensityLevel, string> = {
  Low: "text-signal-green",
  Medium: "text-signal-amber",
  High: "text-warn",
  Critical: "text-signal-red",
};
