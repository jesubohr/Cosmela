"use client";

import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Shown while the browser is offline. v1 has no offline writes. */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="flex items-center gap-2 bg-amber-soft px-4 py-2 text-sm font-medium text-amber lg:px-8">
      <WifiOff className="size-4 shrink-0" />
      Sin conexión. Lo que hagas ahora puede no guardarse hasta que vuelva el internet.
    </div>
  );
}
