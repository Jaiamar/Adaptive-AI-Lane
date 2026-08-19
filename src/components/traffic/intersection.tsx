import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LEVEL_TOKEN, type LaneState, type SignalColor, type TrafficSnapshot } from "@/lib/traffic/types";
import { cn } from "@/lib/utils";

function SignalHead({ signal, vertical = true }: { signal: SignalColor; vertical?: boolean }) {
  const lamp = (color: SignalColor, token: string) => (
    <span
      className={cn(
        "size-3 rounded-full border border-border/60",
        signal === color ? cn(token, "signal-live") : "bg-muted",
      )}
    />
  );
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-md bg-secondary p-1",
        vertical ? "flex-col" : "flex-row",
      )}
    >
      {lamp("red", "bg-signal-red")}
      {lamp("amber", "bg-signal-amber")}
      {lamp("green", "bg-signal-green")}
    </div>
  );
}

export function LaneDensityCard({ lane }: { lane: LaneState }) {
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
            Lane {lane.id}
          </p>
          <p className="font-display text-sm font-semibold">{lane.name}</p>
        </div>
        <SignalHead signal={lane.signal} vertical={false} />
      </div>
      <div className="mt-3 flex items-end justify-between">
        <p className="stat-value text-3xl font-bold">{lane.queue}</p>
        <Badge variant="outline" className={cn("text-[10px]", LEVEL_TOKEN[lane.level])}>
          {lane.level}
        </Badge>
      </div>
      <Progress value={lane.density * 100} className="mt-2 h-1.5" />
      <dl className="mt-3 grid grid-cols-2 gap-y-1 text-[11px] text-muted-foreground">
        <dt>Detected</dt>
        <dd className="stat-value text-right text-foreground">{lane.count}</dd>
        <dt>Avg wait</dt>
        <dd className="stat-value text-right text-foreground">{lane.avgWait.toFixed(1)}s</dd>
        <dt>Arrivals</dt>
        <dd className="stat-value text-right text-foreground">{lane.arrivalRate}/min</dd>
        <dt>Green rec.</dt>
        <dd className="stat-value text-right text-foreground">{lane.recommendedGreen}s</dd>
      </dl>
      {lane.signal === "green" && (
        <p className="mt-3 rounded-md bg-signal-green/15 px-2 py-1 text-center text-xs font-semibold text-signal-green">
          GREEN · {Math.ceil(lane.countdown)}s left of {lane.greenDuration}s
        </p>
      )}
    </div>
  );
}

export function IntersectionView({ snapshot }: { snapshot: TrafficSnapshot }) {
  const get = (id: string) => snapshot.lanes.find((l) => l.id === id)!;
  const emergencyLane = snapshot.emergency.active ? snapshot.emergency.lane : null;

  const arm = (id: "N" | "E" | "S" | "W", cls: string) => {
    const l = get(id);
    return (
      <div className={cn("absolute flex flex-col items-center gap-1", cls)}>
        <SignalHead signal={l.signal} />
        <span
          className={cn(
            "stat-value rounded px-1.5 py-0.5 text-[10px] font-semibold",
            emergencyLane === id
              ? "bg-signal-red/20 text-signal-red"
              : "bg-secondary text-secondary-foreground",
          )}
        >
          {id} · {l.queue}
        </span>
      </div>
    );
  };

  return (
    <div className="panel p-4">
      <p className="font-display text-sm font-semibold">Intersection Visualization</p>
      <div className="relative mx-auto mt-3 aspect-square w-full max-w-[320px] rounded-lg bg-asphalt">
        <div className="absolute inset-x-0 top-1/2 h-[26%] -translate-y-1/2 bg-foreground/5" />
        <div className="absolute inset-y-0 left-1/2 w-[26%] -translate-x-1/2 bg-foreground/5" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-signal-amber/50" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-signal-amber/50" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="stat-value text-2xl font-bold text-primary">
            {Math.ceil(snapshot.countdown)}s
          </p>
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
            {snapshot.activeLane} {snapshot.phase}
          </p>
        </div>
        {arm("N", "top-2 left-1/2 -translate-x-1/2")}
        {arm("S", "bottom-2 left-1/2 -translate-x-1/2")}
        {arm("W", "left-2 top-1/2 -translate-y-1/2")}
        {arm("E", "right-2 top-1/2 -translate-y-1/2")}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Policy: {snapshot.config.aiEnabled ? "AI max-pressure adaptive" : "fixed 30s round-robin"} ·
        limits {snapshot.config.minGreen}-{snapshot.config.maxGreen}s
      </p>
    </div>
  );
}
