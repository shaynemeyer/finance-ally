"use client";

import { usePriceStore, ConnectionStatus as Status } from "@/store/priceStore";

const dotStyles: Record<Status, string> = {
  connected: "bg-green-400",
  reconnecting: "bg-yellow-400 animate-pulse",
  disconnected: "bg-red-500",
};

export function ConnectionStatus() {
  const status = usePriceStore((s) => s.connectionStatus);
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-2 h-2 rounded-full ${dotStyles[status]}`}
        aria-label={status}
      />
      <span className="text-xs text-muted-foreground capitalize">{status}</span>
    </div>
  );
}
