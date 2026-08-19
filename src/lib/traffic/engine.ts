import {
  densityLevel,
  EMERGENCY_TYPES,
  LANES,
  LANE_NAMES,
  type EmergencyEvent,
  type HistorySample,
  type Intersection,
  type LaneId,
  type LaneState,
  type TrafficConfig,
  type TrafficSnapshot,
  type Vehicle,
  type VehicleType,
} from "./types";

/**
 * Browser traffic-control engine.
 *
 * Pipeline (mirrors the reference Python architecture):
 *   frame source -> detector -> per-lane density -> controller (adaptive/RL) -> signal
 * A synthetic detector drives the pipeline here; `ingestDetections()` accepts
 * frames from a real YOLO/OpenCV service (RTSP -> FastAPI -> websocket) without
 * touching the control, prediction or storage layers.
 */

const SATURATION_FLOW = 0.55; // vehicles discharged per second of green
const JAM_CAPACITY = 18; // vehicles per approach at density = 1
const SAMPLE_EVERY = 3; // sim seconds between history samples
const MAX_HISTORY = 240;

const TYPE_MIX: { type: VehicleType; w: number }[] = [
  { type: "car", w: 0.62 },
  { type: "motorcycle", w: 0.18 },
  { type: "bus", w: 0.08 },
  { type: "truck", w: 0.1 },
];

function pickType(): VehicleType {
  const r = Math.random();
  let acc = 0;
  for (const t of TYPE_MIX) {
    acc += t.w;
    if (r <= acc) return t.type;
  }
  return "car";
}

function baseRate(lane: LaneId, hour: number): number {
  // veh/min baseline with morning + evening peaks
  const peak =
    1 + 0.9 * Math.exp(-((hour - 9) ** 2) / 3) + 1.1 * Math.exp(-((hour - 18) ** 2) / 3.5);
  const bias: Record<LaneId, number> = { N: 1.15, E: 0.95, S: 1.05, W: 0.8 };
  return 9 * peak * bias[lane];
}

interface LaneRuntime {
  id: LaneId;
  vehicles: Vehicle[];
  detected: number;
  departed: number;
  waitAccum: number;
  waitSamples: number;
  greenDuration: number;
  densityHistory: number[];
  spawnCarry: number;
  // fixed-timer shadow simulation
  fixedQueue: number;
  fixedWaitAccum: number;
  fixedDeparted: number;
}

export class TrafficEngine {
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextId = 1;
  private simTime = 0;
  private startHour = 8.5;
  private lanes: Record<LaneId, LaneRuntime>;
  private activeIndex = 0;
  private phase: "green" | "amber" = "green";
  private countdown = 12;
  private fixedIndex = 0;
  private fixedCountdown = 30;
  private readonly fixedGreen = 30;
  private history: HistorySample[] = [];
  private lastSample = 0;
  private emergency: {
    active: boolean;
    lane: LaneId | null;
    type: VehicleType | null;
    secondsLeft: number;
  } = { active: false, lane: null, type: null, secondsLeft: 0 };
  private emergencyLog: EmergencyEvent[] = [];
  private nextEmergencyAt = 90 + Math.random() * 120;
  private snapshot: TrafficSnapshot | null = null;

  config: TrafficConfig = {
    intersectionId: "INT-001",
    minGreen: 8,
    maxGreen: 45,
    amber: 3,
    aiEnabled: true,
    emergencyPriority: true,
    demandMultiplier: 1,
    speed: 1,
    detectionConfidence: 0.55,
  };

  intersections: Intersection[] = [
    { id: "INT-001", name: "MG Road x Anna Salai", location: "Zone 1 - CBD", lanes: 4, active: true },
    { id: "INT-002", name: "Ring Road x Sector 9", location: "Zone 3 - Industrial", lanes: 4, active: true },
    { id: "INT-003", name: "Airport Link x NH-48", location: "Zone 5 - Highway", lanes: 4, active: false },
  ];

  constructor() {
    this.lanes = LANES.reduce(
      (acc, id) => {
        acc[id] = {
          id,
          vehicles: [],
          detected: 0,
          departed: 0,
          waitAccum: 0,
          waitSamples: 0,
          greenDuration: 15,
          densityHistory: [],
          spawnCarry: 0,
          fixedQueue: 0,
          fixedWaitAccum: 0,
          fixedDeparted: 0,
        };
        return acc;
      },
      {} as Record<LaneId, LaneRuntime>,
    );
    this.seed();
    this.snapshot = this.build();
  }

  /* ---------------- store plumbing ---------------- */

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.snapshot as TrafficSnapshot;

  private emit() {
    this.snapshot = this.build();
    this.listeners.forEach((l) => l());
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const steps = Math.max(1, Math.round(this.config.speed));
      for (let i = 0; i < steps; i++) this.step(0.25);
      this.emit();
    }, 250);
    this.emit();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.emit();
  }

  get running() {
    return this.timer !== null;
  }

  setConfig(patch: Partial<TrafficConfig>) {
    this.config = { ...this.config, ...patch };
    this.emit();
  }

  addIntersection(i: Intersection) {
    this.intersections = [...this.intersections, i];
    this.emit();
  }

  toggleIntersection(id: string) {
    this.intersections = this.intersections.map((i) =>
      i.id === id ? { ...i, active: !i.active } : i,
    );
    this.emit();
  }

  reset() {
    LANES.forEach((id) => {
      const l = this.lanes[id];
      Object.assign(l, {
        vehicles: [],
        detected: 0,
        departed: 0,
        waitAccum: 0,
        waitSamples: 0,
        densityHistory: [],
        fixedQueue: 0,
        fixedWaitAccum: 0,
        fixedDeparted: 0,
      });
    });
    this.simTime = 0;
    this.history = [];
    this.lastSample = 0;
    this.emergencyLog = [];
    this.emergency = { active: false, lane: null, type: null, secondsLeft: 0 };
    this.seed();
    this.emit();
  }

  /* ---------------- detection layer ---------------- */

  /** Entry point for a real detector (YOLO/OpenCV service). */
  ingestDetections(lane: LaneId, dets: { type: VehicleType; confidence: number }[]) {
    const l = this.lanes[lane];
    dets
      .filter((d) => d.confidence >= this.config.detectionConfidence)
      .forEach((d) => {
        l.vehicles.push(this.makeVehicle(lane, d.type, d.confidence));
        l.detected++;
        if (EMERGENCY_TYPES.includes(d.type)) this.raiseEmergency(lane, d.type);
      });
    this.emit();
  }

  private makeVehicle(lane: LaneId, type: VehicleType, confidence: number): Vehicle {
    return {
      id: this.nextId++,
      lane,
      type,
      confidence,
      pos: 0,
      speed: 0.055 + Math.random() * 0.03,
      waited: 0,
      lateral: Math.random(),
    };
  }

  private seed() {
    LANES.forEach((id) => {
      const n = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) {
        const v = this.makeVehicle(id, pickType(), 0.7 + Math.random() * 0.29);
        v.pos = Math.random() * 0.8;
        this.lanes[id].vehicles.push(v);
        this.lanes[id].detected++;
        this.lanes[id].fixedQueue++;
      }
    });
  }

  triggerEmergency(lane?: LaneId) {
    const target = lane ?? this.laneAt(Math.floor(Math.random() * LANES.length));
    const type: VehicleType = Math.random() > 0.4 ? "ambulance" : "fire_truck";
    const v = this.makeVehicle(target, type, 0.91 + Math.random() * 0.08);
    v.speed = 0.12;
    this.lanes[target].vehicles.unshift(v);
    this.lanes[target].detected++;
    this.raiseEmergency(target, type);
    this.emit();
  }

  private raiseEmergency(lane: LaneId, type: VehicleType) {
    if (!this.config.emergencyPriority) return;
    this.emergency = { active: true, lane, type, secondsLeft: 20 };
    this.emergencyLog = [
      {
        id: this.nextId++,
        lane,
        type,
        at: this.clock(),
        clearedSec: null,
      },
      ...this.emergencyLog,
    ].slice(0, 40);
    // preempt: force the emergency lane green
    this.activeIndex = LANES.indexOf(lane);
    this.phase = "green";
    this.countdown = 20;
  }

  /* ---------------- simulation step ---------------- */

  private step(dt: number) {
    this.simTime += dt;
    const hour = (this.startHour + this.simTime / 600) % 24; // 10 sim-min per sim-hour scale

    // arrivals (Poisson-ish) + synthetic detections
    LANES.forEach((id) => {
      const l = this.lanes[id];
      const rate = (baseRate(id, hour) * this.config.demandMultiplier) / 60; // veh/s
      l.spawnCarry += rate * dt;
      while (l.spawnCarry >= 1) {
        l.spawnCarry -= 1;
        if (l.vehicles.length < JAM_CAPACITY + 6) {
          l.vehicles.push(this.makeVehicle(id, pickType(), 0.6 + Math.random() * 0.39));
          l.detected++;
          l.fixedQueue++;
        }
      }
    });

    // emergency countdown
    if (this.emergency.active) {
      this.emergency.secondsLeft -= dt;
      if (this.emergency.secondsLeft <= 0) {
        const log = this.emergencyLog[0];
        if (log && log.clearedSec === null) log.clearedSec = 20;
        this.emergency = { active: false, lane: null, type: null, secondsLeft: 0 };
      }
    } else {
      this.nextEmergencyAt -= dt;
      if (this.nextEmergencyAt <= 0) {
        this.nextEmergencyAt = 150 + Math.random() * 250;
        this.triggerEmergency();
      }
    }

    // signal FSM (AI adaptive or fixed cycle depending on config)
    this.countdown -= dt;
    if (this.countdown <= 0) {
      if (this.phase === "green") {
        this.phase = "amber";
        this.countdown = this.config.amber;
      } else {
        this.phase = "green";
        this.activeIndex = this.selectNextLane();
        const lane = this.laneAt(this.activeIndex);
        const g = this.computeGreen(lane);
        this.lanes[lane].greenDuration = g;
        this.countdown = g;
      }
    }

    const activeLane = this.laneAt(this.activeIndex);

    // vehicle movement / discharge
    LANES.forEach((id) => {
      const l = this.lanes[id];
      const isGreen = id === activeLane && this.phase === "green";
      let dischargeBudget = isGreen ? SATURATION_FLOW * dt : 0;
      const sorted = l.vehicles.sort((a, b) => b.pos - a.pos);
      sorted.forEach((v, idx) => {
        const stopTarget = 1 - idx * 0.055;
        if (v.pos < stopTarget - 0.001) {
          v.pos = Math.min(stopTarget, v.pos + v.speed * dt);
        } else if (isGreen && idx === 0 && dischargeBudget > 0) {
          dischargeBudget -= 1;
          v.pos = 2; // cleared
          l.departed++;
          l.waitAccum += v.waited;
          l.waitSamples++;
        } else {
          v.waited += dt;
        }
      });
      l.vehicles = sorted.filter((v) => v.pos <= 1.001);
      const density = Math.min(1, l.vehicles.length / JAM_CAPACITY);
      l.densityHistory.push(density);
      if (l.densityHistory.length > 200) l.densityHistory.shift();
    });

    // fixed-timer baseline shadow simulation (same arrivals, 30s per approach)
    this.fixedCountdown -= dt;
    if (this.fixedCountdown <= 0) {
      this.fixedIndex = (this.fixedIndex + 1) % LANES.length;
      this.fixedCountdown = this.fixedGreen + this.config.amber;
    }
    LANES.forEach((id, i) => {
      const l = this.lanes[id];
      if (i === this.fixedIndex && this.fixedCountdown > this.config.amber) {
        const served = Math.min(l.fixedQueue, SATURATION_FLOW * dt);
        l.fixedQueue -= served;
        l.fixedDeparted += served;
      }
      l.fixedWaitAccum += l.fixedQueue * dt;
    });

    if (this.simTime - this.lastSample >= SAMPLE_EVERY) {
      this.lastSample = this.simTime;
      this.pushSample();
    }
  }

  /** Max-pressure / RL-style policy: pressure = queue + wait pressure, emergency overrides. */
  private selectNextLane(): number {
    if (this.emergency.active && this.emergency.lane && this.config.emergencyPriority) {
      return LANES.indexOf(this.emergency.lane);
    }
    if (!this.config.aiEnabled) return (this.activeIndex + 1) % LANES.length;
    const weights = this.pressures();
    let best = 0;
    let bestVal = -Infinity;
    LANES.forEach((id, i) => {
      const w = weights[id] + (i === this.activeIndex ? -0.6 : 0); // discourage starving others
      if (w > bestVal) {
        bestVal = w;
        best = i;
      }
    });
    return best;
  }

  private pressures(): Record<LaneId, number> {
    return LANES.reduce(
      (acc, id) => {
        const l = this.lanes[id];
        const q = l.vehicles.length;
        const maxWait = l.vehicles.reduce((m, v) => Math.max(m, v.waited), 0);
        acc[id] = q * 1 + maxWait * 0.12;
        return acc;
      },
      {} as Record<LaneId, number>,
    );
  }

  /** Adaptive green: queue clearance time bounded by min/max limits. */
  private computeGreen(lane: LaneId): number {
    const { minGreen, maxGreen, aiEnabled } = this.config;
    if (!aiEnabled) return this.fixedGreen;
    const q = this.lanes[lane].vehicles.length;
    const clearance = q / SATURATION_FLOW + 2;
    const share = this.densityShare(lane);
    const scaled = clearance * (0.7 + share);
    return Math.round(Math.max(minGreen, Math.min(maxGreen, scaled)));
  }

  private densityShare(lane: LaneId) {
    const total = LANES.reduce((s, id) => s + this.lanes[id].vehicles.length, 0) || 1;
    return this.lanes[lane].vehicles.length / total;
  }

  /* ---------------- prediction ---------------- */

  private predict(lane: LaneId) {
    const h = this.lanes[lane].densityHistory;
    const w = h.slice(-60);
    if (w.length < 8) {
      const d = h[h.length - 1] ?? 0;
      return { level: densityLevel(d), changePct: 0 };
    }
    // linear least-squares trend + EWMA blend
    const n = w.length;
    const meanX = (n - 1) / 2;
    const meanY = w.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    w.forEach((y, i) => {
      num += (i - meanX) * (y - meanY);
      den += (i - meanX) ** 2;
    });
    const slope = den === 0 ? 0 : num / den;
    let ewma = w[0] as number;
    w.forEach((y) => (ewma = 0.15 * y + 0.85 * ewma));
    const horizon = 40; // samples ahead (~5 min)
    const predicted = Math.max(0, Math.min(1, 0.5 * (ewma + slope * horizon) + 0.5 * (meanY + slope * horizon)));
    const current = w[n - 1] || 0.001;
    return {
      level: densityLevel(predicted),
      changePct: Math.round(((predicted - current) / Math.max(0.05, current)) * 100),
    };
  }

  /* ---------------- snapshot ---------------- */

  private laneAt(i: number): LaneId {
    return LANES[((i % LANES.length) + LANES.length) % LANES.length] as LaneId;
  }

  private clock() {
    const hour = (this.startHour + this.simTime / 600) % 24;
    const h = Math.floor(hour);
    const m = Math.floor((hour - h) * 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  private laneAvgWait(l: LaneRuntime) {
    const queued = l.vehicles.reduce((s, v) => s + v.waited, 0);
    const total = l.waitAccum + queued;
    const n = l.waitSamples + l.vehicles.length;
    return n === 0 ? 0 : total / n;
  }

  private pushSample() {
    const lanes = LANES.map((id) => this.lanes[id]);
    const volume = lanes.reduce((s, l) => s + l.departed, 0);
    const queue = lanes.reduce((s, l) => s + l.vehicles.length, 0);
    const sample: HistorySample = {
      t: Math.round(this.simTime),
      clock: this.clock(),
      volume: Math.round(volume),
      avgWaitAi: Number(this.avgWaitAi().toFixed(1)),
      avgWaitFixed: Number(this.avgWaitFixed().toFixed(1)),
      queue,
      density: Number((queue / (JAM_CAPACITY * 4)).toFixed(3)),
      N: this.lanes.N.vehicles.length,
      E: this.lanes.E.vehicles.length,
      S: this.lanes.S.vehicles.length,
      W: this.lanes.W.vehicles.length,
    };
    this.history = [...this.history, sample].slice(-MAX_HISTORY);
  }

  private avgWaitAi() {
    const l = LANES.map((id) => this.lanes[id]);
    const tot = l.reduce((s, x) => s + x.waitAccum + x.vehicles.reduce((a, v) => a + v.waited, 0), 0);
    const n = l.reduce((s, x) => s + x.waitSamples + x.vehicles.length, 0);
    return n ? tot / n : 0;
  }

  private avgWaitFixed() {
    const l = LANES.map((id) => this.lanes[id]);
    const tot = l.reduce((s, x) => s + x.fixedWaitAccum, 0);
    const n = l.reduce((s, x) => s + x.fixedDeparted + x.fixedQueue, 0);
    return n ? tot / n : 0;
  }

  private build(): TrafficSnapshot {
    const activeLane = this.laneAt(this.activeIndex);
    const hour = (this.startHour + this.simTime / 600) % 24;
    const laneStates: LaneState[] = LANES.map((id) => {
      const l = this.lanes[id];
      const density = Math.min(1, l.vehicles.length / JAM_CAPACITY);
      const isActive = id === activeLane;
      const p = this.predict(id);
      return {
        id,
        name: LANE_NAMES[id],
        count: l.detected,
        queue: l.vehicles.length,
        density,
        level: densityLevel(density),
        signal: isActive ? (this.phase === "green" ? "green" : "amber") : "red",
        greenDuration: l.greenDuration,
        countdown: isActive ? Math.max(0, this.countdown) : 0,
        avgWait: this.laneAvgWait(l),
        arrivalRate: Number((baseRate(id, hour) * this.config.demandMultiplier).toFixed(1)),
        departed: l.departed,
        predictedLevel: p.level,
        predictedChangePct: p.changePct,
        recommendedGreen: this.computeGreen(id),
      };
    });

    const vehicles = LANES.flatMap((id) => this.lanes[id].vehicles.map((v) => ({ ...v })));

    return {
      simTime: Math.round(this.simTime),
      clock: this.clock(),
      running: this.running,
      config: { ...this.config },
      lanes: laneStates,
      vehicles,
      activeLane,
      phase: this.phase,
      countdown: Math.max(0, this.countdown),
      totalDetected: LANES.reduce((s, id) => s + this.lanes[id].detected, 0),
      totalQueue: LANES.reduce((s, id) => s + this.lanes[id].vehicles.length, 0),
      avgWaitAi: this.avgWaitAi(),
      avgWaitFixed: this.avgWaitFixed(),
      throughputAi: LANES.reduce((s, id) => s + this.lanes[id].departed, 0),
      throughputFixed: Math.round(LANES.reduce((s, id) => s + this.lanes[id].fixedDeparted, 0)),
      history: this.history,
      emergency: { ...this.emergency, secondsLeft: Math.max(0, Math.round(this.emergency.secondsLeft)) },
      emergencyLog: this.emergencyLog.map((e) => ({ ...e })),
      intersections: this.intersections.map((i) => ({ ...i })),
      policyWeights: this.pressures(),
    };
  }
}

let engine: TrafficEngine | null = null;

export function getEngine(): TrafficEngine {
  if (!engine) engine = new TrafficEngine();
  return engine;
}
