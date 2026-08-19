import { Link } from "@tanstack/react-router";
import { Activity, BarChart3, FileText, Settings, Moon, Sun, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const links = [
  { to: "/", label: "Dashboard", icon: Activity },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/simulation", label: "Simulation", icon: Radio },
  { to: "/admin", label: "Admin", icon: Settings },
  { to: "/reports", label: "Reports", icon: FileText },
] as const;

function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("tsc-theme");
    const isDark = stored ? stored === "dark" : true;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("tsc-theme", next ? "dark" : "light");
  };

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle dark mode">
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary">
              <Activity className="size-5" />
            </span>
            <span className="font-display text-sm leading-tight font-semibold sm:text-base">
              SmartSignal AI
              <span className="block text-[10px] font-normal tracking-widest text-muted-foreground uppercase">
                Adaptive Traffic Control
              </span>
            </span>
          </Link>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:ml-6 sm:w-auto">
            {links.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&.active]:bg-accent [&.active]:text-accent-foreground"
              >
                <Icon className="size-3.5" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-muted-foreground">
        SmartSignal AI · adaptive control, congestion prediction and emergency preemption running
        live in your browser.
      </footer>
    </div>
  );
}
