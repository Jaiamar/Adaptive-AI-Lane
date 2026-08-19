import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useTraffic } from "@/lib/traffic/store";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Controls — SmartSignal AI" },
      {
        name: "description",
        content:
          "Manage intersections and lanes, set min/max green time, toggle AI optimization, emergency priority and detector confidence.",
      },
      { property: "og:title", content: "Admin Controls — SmartSignal AI" },
      {
        property: "og:description",
        content: "Configure intersections, signal limits and AI optimization settings.",
      },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { snapshot, engine } = useTraffic();
  const c = snapshot.config;
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  return (
    <AppShell>
      <h1 className="text-xl font-bold sm:text-2xl">Admin Controls</h1>
      <p className="text-xs text-muted-foreground">
        Changes apply immediately to the live controller.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="panel space-y-5 p-4">
          <p className="font-display text-sm font-semibold">Signal timing</p>
          <div>
            <div className="flex justify-between text-xs">
              <Label>Minimum green</Label>
              <span className="stat-value">{c.minGreen}s</span>
            </div>
            <Slider
              className="mt-2"
              min={5}
              max={20}
              step={1}
              value={[c.minGreen]}
              onValueChange={([v]) => engine.setConfig({ minGreen: v ?? 8 })}
            />
          </div>
          <div>
            <div className="flex justify-between text-xs">
              <Label>Maximum green</Label>
              <span className="stat-value">{c.maxGreen}s</span>
            </div>
            <Slider
              className="mt-2"
              min={20}
              max={90}
              step={5}
              value={[c.maxGreen]}
              onValueChange={([v]) => engine.setConfig({ maxGreen: v ?? 45 })}
            />
          </div>
          <div>
            <div className="flex justify-between text-xs">
              <Label>Amber duration</Label>
              <span className="stat-value">{c.amber}s</span>
            </div>
            <Slider
              className="mt-2"
              min={2}
              max={6}
              step={1}
              value={[c.amber]}
              onValueChange={([v]) => engine.setConfig({ amber: v ?? 3 })}
            />
          </div>
          <div>
            <div className="flex justify-between text-xs">
              <Label>Detector confidence threshold</Label>
              <span className="stat-value">{c.detectionConfidence.toFixed(2)}</span>
            </div>
            <Slider
              className="mt-2"
              min={0.3}
              max={0.9}
              step={0.05}
              value={[c.detectionConfidence]}
              onValueChange={([v]) => engine.setConfig({ detectionConfidence: v ?? 0.55 })}
            />
          </div>
        </div>

        <div className="panel space-y-4 p-4">
          <p className="font-display text-sm font-semibold">Control modes</p>
          {[
            {
              label: "AI adaptive optimization",
              desc: "Max-pressure policy allocates green by lane demand",
              value: c.aiEnabled,
              set: (v: boolean) => engine.setConfig({ aiEnabled: v }),
            },
            {
              label: "Emergency vehicle priority",
              desc: "Preempt the cycle for ambulance / fire truck",
              value: c.emergencyPriority,
              set: (v: boolean) => engine.setConfig({ emergencyPriority: v }),
            },
          ].map((row) => (
            <div key={row.label} className="flex items-start gap-3 rounded-lg bg-secondary/60 p-3">
              <div className="flex-1">
                <p className="text-xs font-semibold">{row.label}</p>
                <p className="text-[11px] text-muted-foreground">{row.desc}</p>
              </div>
              <Switch checked={row.value} onCheckedChange={row.set} />
            </div>
          ))}
          <div>
            <div className="flex justify-between text-xs">
              <Label>Demand multiplier</Label>
              <span className="stat-value">{c.demandMultiplier.toFixed(1)}x</span>
            </div>
            <Slider
              className="mt-2"
              min={0.3}
              max={2.5}
              step={0.1}
              value={[c.demandMultiplier]}
              onValueChange={([v]) => engine.setConfig({ demandMultiplier: v ?? 1 })}
            />
          </div>
          <div>
            <div className="flex justify-between text-xs">
              <Label>Simulation speed</Label>
              <span className="stat-value">{c.speed}x</span>
            </div>
            <Slider
              className="mt-2"
              min={1}
              max={6}
              step={1}
              value={[c.speed]}
              onValueChange={([v]) => engine.setConfig({ speed: v ?? 1 })}
            />
          </div>
        </div>
      </div>

      <div className="panel mt-4 p-4">
        <p className="font-display text-sm font-semibold">Intersections</p>
        <div className="mt-3 space-y-2">
          {snapshot.intersections.map((i) => (
            <div
              key={i.id}
              className="flex flex-wrap items-center gap-3 rounded-lg bg-secondary/60 px-3 py-2"
            >
              <div className="flex-1">
                <p className="text-xs font-semibold">
                  {i.name}{" "}
                  <span className="stat-value font-normal text-muted-foreground">({i.id})</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {i.location} · {i.lanes} approaches
                </p>
              </div>
              <Badge
                variant="outline"
                className={i.active ? "text-signal-green" : "text-muted-foreground"}
              >
                {i.active ? "online" : "offline"}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => engine.toggleIntersection(i.id)}
              >
                {i.active ? "Disable" : "Enable"}
              </Button>
              <Button
                size="sm"
                variant={c.intersectionId === i.id ? "default" : "outline"}
                className="text-xs"
                onClick={() => engine.setConfig({ intersectionId: i.id })}
              >
                {c.intersectionId === i.id ? "Controlling" : "Control"}
              </Button>
            </div>
          ))}
        </div>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const id = `INT-${String(snapshot.intersections.length + 1).padStart(3, "0")}`;
            engine.addIntersection({
              id,
              name: name.trim(),
              location: location.trim() || "Unassigned zone",
              lanes: 4,
              active: true,
            });
            setName("");
            setLocation("");
            toast.success(`Intersection ${id} added`);
          }}
        >
          <div className="min-w-[180px] flex-1">
            <Label className="text-xs">Intersection name</Label>
            <Input
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Park Street x 3rd Ave"
            />
          </div>
          <div className="min-w-[180px] flex-1">
            <Label className="text-xs">Location / zone</Label>
            <Input
              className="mt-1"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Zone 2 - Retail"
            />
          </div>
          <Button type="submit" size="sm">
            <Plus className="mr-1 size-3.5" /> Add
          </Button>
        </form>
      </div>

      <div className="panel mt-4 p-4">
        <p className="font-display text-sm font-semibold">Camera / detector source</p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          The dashboard currently runs the built-in synthetic detector. A real feed connects by
          streaming YOLO/OpenCV detections from an RTSP worker into{" "}
          <code className="stat-value">engine.ingestDetections(lane, detections)</code> — density,
          adaptive timing, prediction, emergency preemption and storage layers stay unchanged.
        </p>
      </div>
    </AppShell>
  );
}
