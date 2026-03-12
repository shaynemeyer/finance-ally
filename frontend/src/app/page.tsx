"use client";

import { useEffect, useState } from "react";
import { usePriceStream } from "@/hooks/usePriceStream";
import { usePortfolioStore } from "@/store/portfolioStore";
import { WatchlistPanel } from "@/components/watchlist/WatchlistPanel";
import { ConnectionStatus } from "@/components/header/ConnectionStatus";
import { PositionsTabs } from "@/components/portfolio/PositionsTabs";
import { PortfolioHeatmap } from "@/components/portfolio/PortfolioHeatmap";
import { PLChart } from "@/components/portfolio/PLChart";
import { TradeBar } from "@/components/trading/TradeBar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { MainChart } from "@/components/chart/MainChart";

function AppShell() {
  usePriceStream();
  const { portfolio, fetchPortfolio, fetchHistory, fetchTrades, trades, aggregateRealizedPnl } =
    usePortfolioStore();
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);

  useEffect(() => {
    fetchPortfolio();
    fetchHistory();
    fetchTrades();
    const interval = setInterval(() => {
      fetchPortfolio();
      fetchHistory();
    }, 10_000);
    return () => clearInterval(interval);
  }, [fetchPortfolio, fetchHistory, fetchTrades]);

  const totalValue = portfolio?.total_value ?? 0;
  const cashBalance = portfolio?.cash_balance ?? 0;
  const displayedAggregate = selectedYear == null
    ? aggregateRealizedPnl
    : trades
        .filter((t) => new Date(t.executed_at).getFullYear() === selectedYear)
        .reduce((sum, t) => sum + (t.realized_pnl ?? 0), 0);
  const realizedPnlColor = displayedAggregate >= 0 ? "text-green-400" : "text-red-400";

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <h1 className="text-accent font-bold text-lg tracking-tight">Finance Ally</h1>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Portfolio</span>
            <span className="font-mono font-semibold text-sm text-foreground tabular-nums">
              ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Cash</span>
            <span className="font-mono text-sm tabular-nums text-foreground">
              ${cashBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Realized P&L</span>
            <span className={`font-mono text-sm tabular-nums ${realizedPnlColor}`}>
              {displayedAggregate >= 0 ? "+$" : "-$"}
              {Math.abs(displayedAggregate).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <ConnectionStatus />
        </div>
      </header>

      {/* Main layout */}
      <main className="flex flex-1 overflow-hidden">
        {/* Watchlist sidebar */}
        <aside className="w-80 border-r border-border overflow-hidden flex flex-col shrink-0">
          <WatchlistPanel />
        </aside>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Top row: chart placeholder + heatmap */}
          <div className="flex border-b border-border" style={{ height: "220px" }}>
            {/* Main ticker chart */}
            <div className="flex-1 flex flex-col border-r border-border min-w-0">
              <div className="px-3 py-1.5 border-b border-border shrink-0">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chart</span>
              </div>
              <div className="flex-1 min-h-0">
                <MainChart />
              </div>
            </div>
            {/* Portfolio heatmap */}
            <div className="flex flex-col border-l border-border" style={{ width: "260px" }}>
              <div className="px-3 py-1.5 border-b border-border shrink-0">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Heatmap</span>
              </div>
              <div className="flex-1 min-h-0 p-1">
                <PortfolioHeatmap />
              </div>
            </div>
          </div>

          {/* P&L chart row */}
          <div className="border-b border-border flex flex-col shrink-0" style={{ height: "140px" }}>
            <div className="px-3 py-1 border-b border-border shrink-0">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">P&L</span>
            </div>
            <div className="flex-1 min-h-0 px-1 py-1">
              <PLChart />
            </div>
          </div>

          {/* Trade bar */}
          <div className="px-3 py-2 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Trade</span>
              <TradeBar />
            </div>
          </div>

          {/* Positions / Trade History tabs */}
          <PositionsTabs selectedYear={selectedYear} onYearChange={setSelectedYear} />
        </div>

        {/* AI Chat sidebar */}
        <ChatPanel />
      </main>
    </div>
  );
}

export default function Home() {
  return <AppShell />;
}
