import { AlertTriangle, Ambulance, Brain, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LEVEL_TOKEN, type TrafficSnapshot } from "@/lib/traffic/types";
import { cn } from "@/lib/utils";
import type { TrafficEngine } from "@/lib/traffic/engine";

export function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="panel p-4">
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase">{label}</p>
      <p className={cn("stat-value mt-1 text-2xl font-bold", accent)}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function PredictionPanel({ snapshot }: { snapshot: TrafficSnapshot }) {
  return (
    <div className="panel p-4">
      <p className="flex items-center gap-2 font-display text-sm font-semibold">
        <TrendingUp className="size-4 text-primary" /> Congestion Prediction (next ~5 min)
      </p>
      <div className="mt-3 space-y-2">
        {snapshot.lanes.map((l) => (
          <div key={l.id} className="flex items-center gap-3 rounded-lg bg-secondary/60 px-3 py-2">
            <span className="stat-value w-6 text-xs font-bold">{l.id}</span>
            <span className={cn("text-xs font-semibold", LEVEL_TOKEN[l.predictedLevel])}>
              {l.predictedLevel}
            </span>
            <span
              className={cn(
                "stat-value text-xs",
                l.predictedChangePct > 0 ? "text-warn" : "text-signal-green",
              )}
            >
              {l.predictedChangePct > 0 ? "+" : ""}
              {l.predictedChangePct}%
            </span>
            <span className="ml-auto text-[11px] text-muted-foreground">
              recommend {l.recommendedGreen}s green
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmergencyPanel({
  snapshot,
  engine,
}: {
  snapshot: TrafficSnapshot;
  engine: TrafficEngine;
}) {
  const { emergency } = snapshot;
  return (
    <div className={cn("panel p-4", emergency.active && "border-signal-red alert-flash")}>
      <div className="flex items-center gap-2">
        <Ambulance className="size-4 text-signal-red" />
        <p className="font-display text-sm font-semibold">Emergency Vehicle Priority</p>
        <Badge
          variant="outline"
          className={cn(
            "ml-auto text-[10px]",
            snapshot.config.emergencyPriority ? "text-signal-green" : "text-muted-foreground",
          )}
        >
          {snapshot.config.emergencyPriority ? "armed" : "disabled"}
        </Badge>
      </div>
      {emergency.active ? (
        <div className="mt-3 rounded-lg bg-signal-red/15 p-3">
          <p className="font-display text-sm font-bold tracking-wide text-signal-red">
            EMERGENCY PRIORITY ACTIVE
          </p>
          <p className="stat-value mt-1 text-xs">
            {emergency.type?.replace("_", " ").toUpperCase()} · Lane {emergency.lane} · clearing in{" "}
            {emergency.secondsLeft}s
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Signals preempted: lane {emergency.lane} forced green, conflicting approaches held red.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          No emergency vehicle detected. Detector watches for ambulance / fire-truck classes and
          preempts the cycle automatically.
        </p>
      )}
      <Button
        size="sm"
        variant="outline"
        className="mt-3 w-full text-xs"
        onClick={() => engine.triggerEmergency()}
      >
        <AlertTriangle className="mr-1 size-3.5" /> Inject emergency vehicle
      </Button>
      <div className="mt-3 max-h-40 space-y-1 overflow-auto">
        {snapshot.emergencyLog.map((e) => (
          <p key={e.id} className="stat-value text-[11px] text-muted-foreground">
            {e.at} · {e.type.replace("_", " ")} · lane {e.lane} ·{" "}
            {e.clearedSec ? `cleared in ${e.clearedSec}s` : "in progress"}
          </p>
        ))}
        {snapshot.emergencyLog.length === 0 && (
          <p className="text-[11px] text-muted-foreground">No events recorded yet.</p>
        )}
      </div>
    </div>
  );
}

export function AiComparison({ snapshot }: { snapshot: TrafficSnapshot }) {
  const improvement =
    snapshot.avgWaitFixed > 0
      ? ((snapshot.avgWaitFixed - snapshot.avgWaitAi) / snapshot.avgWaitFixed) * 100
      : 0;
  const flow =
    snapshot.throughputFixed > 0
      ? ((snapshot.throughputAi - snapshot.throughputFixed) / snapshot.throughputFixed) * 100
      : 0;
  return (
    <div className="panel p-4">
      <p className="flex items-center gap-2 font-display text-sm font-semibold">
        <Brain className="size-4 text-primary" /> AI vs Fixed-Timer Control
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg bg-secondary/60 p-3">
          <p className="text-muted-foreground">AI adaptive wait</p>
          <p className="stat-value text-lg font-bold text-signal-green">
            {snapshot.avgWaitAi.toFixed(1)}s
          </p>
        </div>
        <div className="rounded-lg bg-secondary/60 p-3">
          <p className="text-muted-foreground">Fixed 30s wait</p>
          <p className="stat-value text-lg font-bold text-signal-red">
            {snapshot.avgWaitFixed.toFixed(1)}s
          </p>
        </div>
        <div className="rounded-lg bg-secondary/60 p-3">
          <p className="text-muted-foreground">Waiting-time gain</p>
          <p className="stat-value text-lg font-bold">{improvement.toFixed(0)}%</p>
        </div>
        <div className="rounded-lg bg-secondary/60 p-3">
          <p className="text-muted-foreground">Throughput gain</p>
          <p className="stat-value text-lg font-bold">{flow.toFixed(0)}%</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Both controllers are fed identical arrival streams; the baseline runs a 30s round-robin cycle
        while the AI controller allocates green time by lane pressure.
      </p>
    </div>
  );
}
