import { useEffect, useSyncExternalStore } from "react";
import { getEngine } from "./engine";
import type { TrafficSnapshot } from "./types";

const serverSnapshot = () => getEngine().getSnapshot();

export function useTraffic(): { snapshot: TrafficSnapshot; engine: ReturnType<typeof getEngine> } {
  const engine = getEngine();
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, serverSnapshot);

  useEffect(() => {
    engine.start();
  }, [engine]);

  return { snapshot, engine };
}
