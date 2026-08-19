import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Play } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { MetricCard } from "@/components/traffic/panels";
import { runScenarios, type ScenarioResult } from "@/lib/traffic/sumo";
import { useTraffic } from "@/lib/traffic/store";

export const Route = createFileRoute("/simulation")({
  head: () => ({
    meta: [
      { title: "SUMO-Style Simulation — SmartSignal AI" },
      {
        name: "description",
        content:
          "Batch intersection simulation replaying identical demand through fixed-time and AI adaptive signal control to measure delay, queue and throughput gains.",
      },
      { property: "og:title", content: "Signal Control Simulation — SmartSignal AI" },
      {
        property: "og:description",
        content: "Compare fixed-time vs AI adaptive signals before real-world deployment.",
      },
    ],
  }),
  component: Simulation,
});

const DEMANDS = [400, 700, 1000, 1300, 1600];

function Simulation() {
  const { snapshot } = useTraffic();
  const [horizon, setHorizon] = useState(1800);
  const [runId, setRunId] = useState(0);

  const results: ScenarioResult[] = useMemo(
    () =>
      runScenarios(
        DEMANDS,
        { minGreen: snapshot.config.minGreen, maxGreen: snapshot.config.maxGreen },
        horizon,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [horizon, snapshot.config.minGreen, snapshot.config.maxGreen, runId],
  );

  const avgWaitGain = results.reduce((s, r) => s + r.waitGainPct, 0) / results.length;
  const avgQueueGain = results.reduce((s, r) => s + r.queueGainPct, 0) / results.length;
  const avgFlowGain = results.reduce((s, r) => s + r.flowGainPct, 0) / results.length;

  const axis = { stroke: "var(--muted-foreground)", fontSize: 10, tickLine: false, axisLine: false };
  const tip = {
    contentStyle: {
      background: "var(--popover)",
      border: "1px solid var(--border)",
      borderRadius: "8px",
      fontSize: "11px",
    },
  };

  return (
    <AppShell>
      <h1 className="text-xl font-bold sm:text-2xl">Intersection Simulation</h1>
      <p className="text-xs text-muted-foreground">
        SUMO-style batch experiment: Poisson demand traces are replayed identically through the
        fixed-time controller and the adaptive controller, using the green-time limits configured in
        Admin.
      </p>

      <div className="panel mt-4 flex flex-wrap items-center gap-4 p-4">
        <div className="min-w-[220px] flex-1">
          <p className="text-[11px] text-muted-foreground">
            Simulation horizon: <span className="stat-value">{horizon}s</span>
          </p>
          <Slider
            className="mt-2"
            min={600}
            max={5400}
            step={300}
            value={[horizon]}
            onValueChange={([v]) => setHorizon(v ?? 1800)}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Green limits {snapshot.config.minGreen}–{snapshot.config.maxGreen}s
        </p>
        <Button size="sm" onClick={() => setRunId((r) => r + 1)}>
          <Play className="mr-1 size-3.5" /> Re-run simulation
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <MetricCard
          label="Waiting time saved"
          value={`${avgWaitGain.toFixed(1)}%`}
          accent="text-signal-green"
        />
        <MetricCard label="Queue reduction" value={`${avgQueueGain.toFixed(1)}%`} />
        <MetricCard label="Throughput gain" value={`${avgFlowGain.toFixed(1)}%`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="panel p-4">
          <p className="font-display text-sm font-semibold">Average delay vs demand</p>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={results}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="demand" {...axis} unit=" v/h" />
                <YAxis {...axis} unit="s" />
                <Tooltip {...tip} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line
                  dataKey="fixedWait"
                  name="Fixed time"
                  stroke="var(--chart-4)"
                  strokeWidth={2}
                />
                <Line
                  dataKey="adaptiveWait"
                  name="AI adaptive"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel p-4">
          <p className="font-display text-sm font-semibold">Throughput vs demand</p>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={results}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="demand" {...axis} unit=" v/h" />
                <YAxis {...axis} />
                <Tooltip {...tip} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar
                  dataKey="fixedThroughput"
                  name="Fixed"
                  fill="var(--chart-4)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="adaptiveThroughput"
                  name="Adaptive"
                  fill="var(--chart-2)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="panel mt-4 overflow-x-auto p-4">
        <p className="font-display text-sm font-semibold">Scenario results</p>
        <table className="mt-3 w-full min-w-[640px] text-xs">
          <thead className="text-muted-foreground">
            <tr className="text-left">
              <th className="py-1">Demand (v/h/approach)</th>
              <th>Fixed delay</th>
              <th>AI delay</th>
              <th>Fixed queue</th>
              <th>AI queue</th>
              <th>Delay saved</th>
              <th>Queue saved</th>
              <th>Flow gain</th>
            </tr>
          </thead>
          <tbody className="stat-value">
            {results.map((r) => (
              <tr key={r.demand} className="border-t border-border">
                <td className="py-1.5">{r.demand}</td>
                <td>{r.fixedWait}s</td>
                <td>{r.adaptiveWait}s</td>
                <td>{r.fixedQueue}</td>
                <td>{r.adaptiveQueue}</td>
                <td className="text-signal-green">{r.waitGainPct}%</td>
                <td className="text-signal-green">{r.queueGainPct}%</td>
                <td>{r.flowGainPct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
