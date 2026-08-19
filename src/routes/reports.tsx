import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildReport, toCsv, type ReportSpan } from "@/lib/traffic/reports";
import { useTraffic } from "@/lib/traffic/store";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Traffic Reports — SmartSignal AI" },
      {
        name: "description",
        content:
          "Daily, weekly and monthly traffic reports: volume, peak periods, waiting time, congestion statistics, signal efficiency and emergency events.",
      },
      { property: "og:title", content: "Traffic Reports — SmartSignal AI" },
      {
        property: "og:description",
        content: "Exportable daily, weekly and monthly signal performance reports.",
      },
    ],
  }),
  component: Reports,
});

function Reports() {
  const { snapshot } = useTraffic();
  const [span, setSpan] = useState<ReportSpan>("daily");
  const rows = useMemo(() => buildReport(snapshot, span), [snapshot, span]);

  const download = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smartsignal-${span}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Reports</h1>
          <p className="text-xs text-muted-foreground">
            Aggregated from stored traffic records for {snapshot.config.intersectionId}.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Tabs value={span} onValueChange={(v) => setSpan(v as ReportSpan)}>
            <TabsList>
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" variant="outline" onClick={download}>
            <Download className="mr-1 size-3.5" /> CSV
          </Button>
        </div>
      </div>

      <div className="panel mt-4 overflow-x-auto p-4">
        <table className="w-full min-w-[720px] text-xs">
          <thead className="text-muted-foreground">
            <tr className="text-left">
              <th className="py-1">Period</th>
              <th>Volume</th>
              <th>Peak</th>
              <th>Avg wait (AI)</th>
              <th>Avg wait (fixed)</th>
              <th>Improvement</th>
              <th>Congested time</th>
              <th>Emergencies</th>
              <th>Signal efficiency</th>
            </tr>
          </thead>
          <tbody className="stat-value">
            {rows.map((r) => (
              <tr key={r.period} className="border-t border-border">
                <td className="py-1.5">{r.period}</td>
                <td>{r.volume.toLocaleString()}</td>
                <td>{r.peak}</td>
                <td>{r.avgWait}s</td>
                <td>{r.fixedWait}s</td>
                <td className="text-signal-green">{r.improvementPct}%</td>
                <td>{r.congestionPct}%</td>
                <td>{r.emergencies}</td>
                <td>{r.efficiency}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel mt-4 p-4">
        <p className="font-display text-sm font-semibold">Stored record types</p>
        <ul className="mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
          {[
            "Vehicle counts per lane and class",
            "Traffic density time series",
            "Signal timing decisions and phase log",
            "Waiting time and queue length samples",
            "Congestion predictions vs actuals",
            "Emergency preemption events",
          ].map((x) => (
            <li key={x}>· {x}</li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {snapshot.history.length} samples currently held in the session store. Enable Cloud Storage
          to persist these records to Postgres for long-horizon historical reporting.
        </p>
      </div>
    </AppShell>
  );
}
