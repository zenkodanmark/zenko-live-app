import { type ReactNode, useEffect, useState } from "react";

export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  if (!ready) return <>{fallback}</>;
  return <>{children}</>;
}
