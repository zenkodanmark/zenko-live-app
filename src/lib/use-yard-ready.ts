import { useEffect, useState } from "react";
import { useYard } from "./store";

export function useYardReady() {
  const [ready, setReady] = useState(() => {
    try {
      return useYard.persist.hasHydrated();
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      if (useYard.persist.hasHydrated()) {
        setReady(true);
        return;
      }
      const unsub = useYard.persist.onFinishHydration(() => setReady(true));
      const wait = window.setTimeout(() => setReady(true), 400);
      return () => {
        unsub();
        window.clearTimeout(wait);
      };
    } catch {
      setReady(true);
    }
  }, []);
  return ready;
}
