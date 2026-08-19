import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LANES, type LaneId, type TrafficSnapshot, type VehicleType } from "@/lib/traffic/types";

const TYPE_LABEL: Record<VehicleType, string> = {
  car: "car",
  bus: "bus",
  truck: "truck",
  motorcycle: "moto",
  ambulance: "AMBULANCE",
  fire_truck: "FIRE TRUCK",
};

const TYPE_SIZE: Record<VehicleType, [number, number]> = {
  car: [0.16, 0.1],
  motorcycle: [0.08, 0.07],
  bus: [0.22, 0.17],
  truck: [0.22, 0.15],
  ambulance: [0.2, 0.15],
  fire_truck: [0.22, 0.16],
};

function cssVar(el: HTMLElement, name: string) {
  return getComputedStyle(el).getPropertyValue(name).trim() || "#888";
}

/** Simulated CCTV panel: renders the detector output (boxes, class, confidence). */
export function LiveCamera({ snapshot }: { snapshot: TrafficSnapshot }) {
  const [lane, setLane] = useState<LaneId>("N");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const laneState = snapshot.lanes.find((l) => l.id === lane)!;
  const vehicles = snapshot.vehicles.filter((v) => v.lane === lane);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = (canvas.width = canvas.clientWidth * 2);
    const h = (canvas.height = canvas.clientHeight * 2);
    ctx.scale(1, 1);

    const asphalt = cssVar(canvas, "--asphalt");
    const green = cssVar(canvas, "--signal-green");
    const amber = cssVar(canvas, "--signal-amber");
    const red = cssVar(canvas, "--signal-red");
    const primary = cssVar(canvas, "--primary");
    const fg = cssVar(canvas, "--foreground");

    ctx.clearRect(0, 0, w, h);
    // sky + road (perspective)
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.35);
    sky.addColorStop(0, cssVar(canvas, "--card"));
    sky.addColorStop(1, cssVar(canvas, "--muted"));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * 0.35);
    ctx.fillStyle = asphalt;
    ctx.beginPath();
    ctx.moveTo(w * 0.34, h * 0.35);
    ctx.lineTo(w * 0.66, h * 0.35);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // lane markings
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 22]);
    [0.44, 0.56].forEach((t, i) => {
      ctx.beginPath();
      ctx.moveTo(w * t, h * 0.35);
      ctx.lineTo(w * (i === 0 ? 0.22 : 0.78), h);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // stop line
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 0.92);
    ctx.lineTo(w * 0.92, h * 0.92);
    ctx.stroke();

    // detection boxes
    const boxColor = (t: VehicleType) =>
      t === "ambulance" || t === "fire_truck" ? red : t === "bus" || t === "truck" ? amber : primary;

    vehicles.forEach((v) => {
      const p = Math.min(1, Math.max(0, v.pos));
      const scale = 0.25 + p * 0.95;
      const y = h * (0.36 + p * 0.5);
      const centerX = w * (0.5 + (v.lateral - 0.5) * (0.18 + p * 0.42));
      const [bw, bh] = TYPE_SIZE[v.type];
      const boxW = w * bw * scale;
      const boxH = h * bh * scale;
      const x = centerX - boxW / 2;

      // vehicle body
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.fillRect(x + boxW * 0.1, y + boxH * 0.15, boxW * 0.8, boxH * 0.7);

      ctx.strokeStyle = boxColor(v.type);
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, boxW, boxH);

      const label = `${TYPE_LABEL[v.type]} ${v.confidence.toFixed(2)}`;
      ctx.font = "600 20px ui-monospace, monospace";
      const tw = ctx.measureText(label).width + 12;
      ctx.fillStyle = boxColor(v.type);
      ctx.fillRect(x, y - 24, tw, 24);
      ctx.fillStyle = cssVar(canvas, "--background");
      ctx.fillText(label, x + 6, y - 6);
    });

    // HUD
    const sig = laneState.signal;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(16, 16, 330, 132);
    ctx.fillStyle = fg;
    ctx.font = "700 22px ui-monospace, monospace";
    ctx.fillText(`CAM-${lane}  ${snapshot.clock}  ${snapshot.config.intersectionId}`, 30, 46);
    ctx.font = "500 20px ui-monospace, monospace";
    ctx.fillStyle = "#fff";
    ctx.fillText(`DETECTED: ${vehicles.length}   QUEUE: ${laneState.queue}`, 30, 78);
    ctx.fillText(`DENSITY: ${laneState.level} (${Math.round(laneState.density * 100)}%)`, 30, 106);
    ctx.fillStyle = sig === "green" ? green : sig === "amber" ? amber : red;
    ctx.fillText(`SIGNAL: ${sig.toUpperCase()} ${Math.ceil(laneState.countdown)}s`, 30, 134);
  }, [vehicles, laneState, lane, snapshot.clock, snapshot.config.intersectionId]);

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="size-2 rounded-full bg-signal-red signal-live" />
          Live Camera Feed
        </span>
        <Badge variant="secondary" className="font-mono text-[10px]">
          simulated detector · conf ≥ {snapshot.config.detectionConfidence.toFixed(2)}
        </Badge>
        <div className="ml-auto flex gap-1">
          {LANES.map((l) => (
            <Button
              key={l}
              size="sm"
              variant={l === lane ? "default" : "outline"}
              className="h-7 px-2 text-xs"
              onClick={() => setLane(l)}
            >
              CAM-{l}
            </Button>
          ))}
        </div>
      </div>
      <canvas ref={canvasRef} className="block h-[300px] w-full sm:h-[380px]" />
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        {snapshot.lanes.map((l) => (
          <div key={l.id} className="bg-card px-3 py-2">
            <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Lane {l.id}</p>
            <p className="stat-value text-sm font-semibold">
              {l.queue} <span className="text-xs text-muted-foreground">veh · {l.level}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
