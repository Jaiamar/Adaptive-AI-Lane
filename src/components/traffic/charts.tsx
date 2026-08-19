import {
  Area,
  AreaChart,
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
import type { TrafficSnapshot } from "@/lib/traffic/types";

const axis = {
  stroke: "var(--muted-foreground)",
  fontSize: 10,
  tickLine: false,
  axisLine: false,
};

const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontSize: "11px",
    color: "var(--popover-foreground)",
  },
};

export function ChartPanel({
  title,
  subtitle,
  children,
  height = 220,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <div className="panel p-4">
      <p className="font-display text-sm font-semibold">{title}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      <div style={{ height }} className="mt-3">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function FlowChart({ snapshot }: { snapshot: TrafficSnapshot }) {
  return (
    <ChartPanel title="Traffic Flow" subtitle="Cumulative vehicles cleared vs queue length">
      <AreaChart data={snapshot.history}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="clock" {...axis} />
        <YAxis {...axis} />
        <Tooltip {...tooltipStyle} />
        <Area
          type="monotone"
          dataKey="volume"
          name="Cleared"
          stroke="var(--chart-1)"
          fill="var(--chart-1)"
          fillOpacity={0.2}
        />
        <Area
          type="monotone"
          dataKey="queue"
          name="Queue"
          stroke="var(--chart-4)"
          fill="var(--chart-4)"
          fillOpacity={0.15}
        />
      </AreaChart>
    </ChartPanel>
  );
}

export function WaitComparisonChart({ snapshot }: { snapshot: TrafficSnapshot }) {
  return (
    <ChartPanel title="Average Waiting Time" subtitle="AI adaptive vs fixed-timer baseline (s)">
      <LineChart data={snapshot.history}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="clock" {...axis} />
        <YAxis {...axis} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Line
          type="monotone"
          dataKey="avgWaitAi"
          name="AI adaptive"
          dot={false}
          stroke="var(--chart-2)"
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="avgWaitFixed"
          name="Fixed timer"
          dot={false}
          stroke="var(--chart-4)"
          strokeWidth={2}
        />
      </LineChart>
    </ChartPanel>
  );
}

export function LaneChart({ snapshot }: { snapshot: TrafficSnapshot }) {
  return (
    <ChartPanel title="Lane-wise Traffic" subtitle="Queue per approach over time">
      <AreaChart data={snapshot.history} stackOffset="none">
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="clock" {...axis} />
        <YAxis {...axis} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {(["N", "E", "S", "W"] as const).map((k, i) => (
          <Area
            key={k}
            type="monotone"
            dataKey={k}
            stackId="1"
            stroke={`var(--chart-${i + 1})`}
            fill={`var(--chart-${i + 1})`}
            fillOpacity={0.25}
          />
        ))}
      </AreaChart>
    </ChartPanel>
  );
}

export function CongestionChart({ snapshot }: { snapshot: TrafficSnapshot }) {
  const data = snapshot.history.map((h) => ({ ...h, pct: Math.round(h.density * 100) }));
  return (
    <ChartPanel title="Congestion Level" subtitle="Network density %, thresholds at 30/55/80%">
      <AreaChart data={data}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="clock" {...axis} />
        <YAxis {...axis} domain={[0, 100]} />
        <Tooltip {...tooltipStyle} />
        <Area
          type="monotone"
          dataKey="pct"
          name="Density %"
          stroke="var(--chart-3)"
          fill="var(--chart-3)"
          fillOpacity={0.25}
        />
      </AreaChart>
    </ChartPanel>
  );
}

export function SignalTimingChart({ snapshot }: { snapshot: TrafficSnapshot }) {
  const data = snapshot.lanes.map((l) => ({
    lane: l.id,
    adaptive: l.recommendedGreen,
    fixed: 30,
    queue: l.queue,
  }));
  return (
    <ChartPanel title="Signal Timing Comparison" subtitle="Allocated green seconds per approach">
      <BarChart data={data}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="lane" {...axis} />
        <YAxis {...axis} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Bar dataKey="adaptive" name="AI adaptive" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="fixed" name="Fixed" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartPanel>
  );
}
