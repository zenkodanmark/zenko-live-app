import { type ReactNode, useEffect, useState } from "react";

export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [ready, setReady] = useState(() => typeof window !== "undefined");
  useEffect(() => {
    if (!ready) setReady(true);
  }, [ready]);
  if (!ready) return <>{fallback}</>;
  return <>{children}</>;
}
