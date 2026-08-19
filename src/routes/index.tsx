import { createFileRoute } from "@tanstack/react-router";
import { Pause, Play, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LiveCamera } from "@/components/traffic/live-camera";
import { IntersectionView, LaneDensityCard } from "@/components/traffic/intersection";
import {
  AiComparison,
  EmergencyPanel,
  MetricCard,
  PredictionPanel,
} from "@/components/traffic/panels";
import { FlowChart, WaitComparisonChart } from "@/components/traffic/charts";
import { useTraffic } from "@/lib/traffic/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SmartSignal AI — Adaptive Traffic Signal Control Dashboard" },
      {
        name: "description",
        content:
          "Live AI traffic control room: vehicle detection, lane density, adaptive green timing, congestion prediction and emergency vehicle priority.",
      },
      { property: "og:title", content: "SmartSignal AI — Adaptive Traffic Control" },
      {
        property: "og:description",
        content:
          "Real-time congestion prediction and adaptive signal control with AI vs fixed-timer comparison.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { snapshot, engine } = useTraffic();
  const improvement =
    snapshot.avgWaitFixed > 0
      ? ((snapshot.avgWaitFixed - snapshot.avgWaitAi) / snapshot.avgWaitFixed) * 100
      : 0;

  return (
    <AppShell>
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Traffic Control Room</h1>
          <p className="text-xs text-muted-foreground">
            {snapshot.config.intersectionId} · sim clock {snapshot.clock} · t+{snapshot.simTime}s
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {snapshot.config.aiEnabled ? "AI optimization ON" : "fixed timer mode"}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => (snapshot.running ? engine.stop() : engine.start())}
          >
            {snapshot.running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </Button>
          <Button size="sm" variant="outline" onClick={() => engine.reset()}>
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Total detected"
          value={String(snapshot.totalDetected)}
          sub={`${snapshot.throughputAi} cleared`}
        />
        <MetricCard
          label="Queue length"
          value={String(snapshot.totalQueue)}
          sub="vehicles waiting network-wide"
        />
        <MetricCard
          label="Avg waiting time"
          value={`${snapshot.avgWaitAi.toFixed(1)}s`}
          sub={`fixed timer ${snapshot.avgWaitFixed.toFixed(1)}s`}
          accent="text-signal-green"
        />
        <MetricCard
          label="AI improvement"
          value={`${improvement.toFixed(0)}%`}
          sub="less waiting than fixed cycle"
          accent="text-primary"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LiveCamera snapshot={snapshot} />
        </div>
        <div className="space-y-4">
          <IntersectionView snapshot={snapshot} />
          <EmergencyPanel snapshot={snapshot} engine={engine} />
        </div>
      </div>

      <h2 className="mt-6 text-sm font-semibold tracking-wide uppercase">Lane density</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {snapshot.lanes.map((l) => (
          <LaneDensityCard key={l.id} lane={l} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <FlowChart snapshot={snapshot} />
        <WaitComparisonChart snapshot={snapshot} />
        <PredictionPanel snapshot={snapshot} />
        <AiComparison snapshot={snapshot} />
      </div>
    </AppShell>
  );
}
