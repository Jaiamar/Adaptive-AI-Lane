import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import {
  CongestionChart,
  FlowChart,
  LaneChart,
  SignalTimingChart,
  WaitComparisonChart,
} from "@/components/traffic/charts";
import { MetricCard } from "@/components/traffic/panels";
import { useTraffic } from "@/lib/traffic/store";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Traffic Analytics — SmartSignal AI" },
      {
        name: "description",
        content:
          "Traffic volume, waiting time, lane-wise load, congestion levels and AI vs fixed-timer signal performance charts.",
      },
      { property: "og:title", content: "Traffic Analytics — SmartSignal AI" },
      {
        property: "og:description",
        content: "Charts for volume, waiting time, congestion and AI signal performance.",
      },
    ],
  }),
  component: Analytics,
});

function Analytics() {
  const { snapshot } = useTraffic();
  const peak = snapshot.history.reduce(
    (best, h) => (h.queue > best.queue ? h : best),
    snapshot.history[0] ?? { queue: 0, clock: "--:--" },
  );
  const congestedShare = snapshot.history.length
    ? (snapshot.history.filter((h) => h.density >= 0.55).length / snapshot.history.length) * 100
    : 0;

  return (
    <AppShell>
      <h1 className="text-xl font-bold sm:text-2xl">Analytics</h1>
      <p className="text-xs text-muted-foreground">
        Derived from {snapshot.history.length} samples of the live control session.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Vehicles cleared" value={String(snapshot.throughputAi)} sub="AI control" />
        <MetricCard
          label="Baseline cleared"
          value={String(snapshot.throughputFixed)}
          sub="fixed timer"
        />
        <MetricCard label="Peak queue" value={`${peak.queue}`} sub={`at ${peak.clock}`} />
        <MetricCard
          label="Congested time"
          value={`${congestedShare.toFixed(0)}%`}
          sub="density ≥ 55%"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <FlowChart snapshot={snapshot} />
        <WaitComparisonChart snapshot={snapshot} />
        <LaneChart snapshot={snapshot} />
        <CongestionChart snapshot={snapshot} />
        <SignalTimingChart snapshot={snapshot} />
        <div className="panel p-4">
          <p className="font-display text-sm font-semibold">Lane summary</p>
          <table className="mt-3 w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="py-1">Lane</th>
                <th>Detected</th>
                <th>Queue</th>
                <th>Density</th>
                <th>Avg wait</th>
                <th>Cleared</th>
              </tr>
            </thead>
            <tbody className="stat-value">
              {snapshot.lanes.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="py-1.5">{l.id}</td>
                  <td>{l.count}</td>
                  <td>{l.queue}</td>
                  <td>{Math.round(l.density * 100)}%</td>
                  <td>{l.avgWait.toFixed(1)}s</td>
                  <td>{l.departed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
