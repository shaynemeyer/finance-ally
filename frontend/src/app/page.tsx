"use client";

import { usePriceStream } from "@/hooks/usePriceStream";
import { WatchlistPanel } from "@/components/watchlist/WatchlistPanel";
import { ConnectionStatus } from "@/components/header/ConnectionStatus";

function AppShell() {
  usePriceStream();
  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <h1 className="text-accent font-bold text-lg tracking-tight">
          Finance Ally
        </h1>
        <ConnectionStatus />
      </header>
      <main className="flex flex-1 overflow-hidden">
        <aside className="w-80 border-r border-border overflow-hidden flex flex-col shrink-0">
          <WatchlistPanel />
        </aside>
        <section className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Select a ticker to view the chart
        </section>
      </main>
    </div>
  );
}

export default function Home() {
  return <AppShell />;
}
