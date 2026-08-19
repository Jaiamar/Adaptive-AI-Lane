/**
 * Lightweight SUMO-style micro-simulation used for offline batch experiments.
 * Mirrors the SUMO/TraCI comparison step: identical demand traces are replayed
 * through a fixed-time controller and the adaptive controller, then aggregate
 * KPIs (delay, queue, throughput) are compared.
 */

export interface ScenarioResult {
  demand: number; // veh/h per approach
  fixedWait: number;
  adaptiveWait: number;
  fixedQueue: number;
  adaptiveQueue: number;
  fixedThroughput: number;
  adaptiveThroughput: number;
  waitGainPct: number;
  queueGainPct: number;
  flowGainPct: number;
}

const SAT = 0.55; // veh/s discharge
const AMBER = 3;

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildArrivals(demand: number, horizon: number, seed: number) {
  const rnd = mulberry(seed);
  const perLane: number[][] = [[], [], [], []];
  for (let lane = 0; lane < 4; lane++) {
    const rate = (demand / 3600) * (0.75 + lane * 0.15);
    let t = 0;
    while (t < horizon) {
      t += -Math.log(1 - rnd()) / rate;
      if (t < horizon) perLane[lane]!.push(t);
    }
  }
  return perLane;
}

function simulate(
  arrivals: number[][],
  horizon: number,
  policy: "fixed" | "adaptive",
  limits: { minGreen: number; maxGreen: number },
) {
  const dt = 0.5;
  const idx = [0, 0, 0, 0];
  const queues = [0, 0, 0, 0];
  const waitBank = [0, 0, 0, 0];
  let departed = 0;
  let queueArea = 0;
  let arrived = 0;
  let active = 0;
  let phase: "green" | "amber" = "green";
  let timer = policy === "fixed" ? 30 : limits.minGreen;

  for (let t = 0; t < horizon; t += dt) {
    for (let l = 0; l < 4; l++) {
      const list = arrivals[l]!;
      while (idx[l]! < list.length && list[idx[l]!]! <= t) {
        idx[l]!++;
        queues[l]!++;
        arrived++;
      }
    }
    timer -= dt;
    if (timer <= 0) {
      if (phase === "green") {
        phase = "amber";
        timer = AMBER;
      } else {
        phase = "green";
        if (policy === "fixed") {
          active = (active + 1) % 4;
          timer = 30;
        } else {
          let best = 0;
          let bestVal = -1;
          for (let l = 0; l < 4; l++) {
            const val = queues[l]! - (l === active ? 1.5 : 0);
            if (val > bestVal) {
              bestVal = val;
              best = l;
            }
          }
          active = best;
          timer = Math.max(
            limits.minGreen,
            Math.min(limits.maxGreen, queues[active]! / SAT + 2),
          );
        }
      }
    }
    if (phase === "green") {
      const served = Math.min(queues[active]!, SAT * dt);
      queues[active]! -= served;
      departed += served;
    }
    for (let l = 0; l < 4; l++) {
      waitBank[l]! += queues[l]! * dt;
      queueArea += queues[l]! * dt;
    }
  }

  const totalWait = waitBank.reduce((a, b) => a + b, 0);
  return {
    avgWait: arrived ? totalWait / arrived : 0,
    avgQueue: queueArea / horizon,
    throughput: Math.round(departed),
  };
}

export function runScenarios(
  demands: number[],
  limits: { minGreen: number; maxGreen: number },
  horizon = 1800,
): ScenarioResult[] {
  return demands.map((demand, i) => {
    const arrivals = buildArrivals(demand, horizon, 1234 + i * 77);
    const fixed = simulate(arrivals, horizon, "fixed", limits);
    const adaptive = simulate(arrivals, horizon, "adaptive", limits);
    const pct = (a: number, b: number) => (a > 0 ? ((a - b) / a) * 100 : 0);
    return {
      demand,
      fixedWait: Number(fixed.avgWait.toFixed(1)),
      adaptiveWait: Number(adaptive.avgWait.toFixed(1)),
      fixedQueue: Number(fixed.avgQueue.toFixed(1)),
      adaptiveQueue: Number(adaptive.avgQueue.toFixed(1)),
      fixedThroughput: fixed.throughput,
      adaptiveThroughput: adaptive.throughput,
      waitGainPct: Number(pct(fixed.avgWait, adaptive.avgWait).toFixed(1)),
      queueGainPct: Number(pct(fixed.avgQueue, adaptive.avgQueue).toFixed(1)),
      flowGainPct: Number(
        (fixed.throughput
          ? ((adaptive.throughput - fixed.throughput) / fixed.throughput) * 100
          : 0
        ).toFixed(1),
      ),
    };
  });
}
