"use client";

import { usePortfolioStore } from "@/store/portfolioStore";

interface Props {
  selectedYear: number | undefined;
  onYearChange: (year: number | undefined) => void;
}

export function TradeHistoryTable({ selectedYear, onYearChange }: Props) {
  const trades = usePortfolioStore((s) => s.trades);

  const years = [...new Set(trades.map((t) => new Date(t.executed_at).getFullYear()))].sort(
    (a, b) => b - a
  );

  const visibleTrades =
    selectedYear == null
      ? trades
      : trades.filter((t) => new Date(t.executed_at).getFullYear() === selectedYear);

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        No trades yet
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {years.length > 0 && (
        <div className="px-3 py-1.5 border-b border-border shrink-0 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Tax year</span>
          <select
            value={selectedYear ?? ""}
            onChange={(e) =>
              onYearChange(e.target.value ? Number(e.target.value) : undefined)
            }
            className="text-xs bg-background border border-border rounded px-1.5 py-0.5 text-foreground"
          >
            <option value="">All</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="overflow-y-auto flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background border-b border-border">
            <tr>
              <th className="px-3 py-1.5 text-left text-xs text-muted-foreground font-medium">Date</th>
              <th className="px-3 py-1.5 text-left text-xs text-muted-foreground font-medium">Ticker</th>
              <th className="px-3 py-1.5 text-left text-xs text-muted-foreground font-medium">Side</th>
              <th className="px-3 py-1.5 text-right text-xs text-muted-foreground font-medium">Qty</th>
              <th className="px-3 py-1.5 text-right text-xs text-muted-foreground font-medium">Price</th>
              <th className="px-3 py-1.5 text-right text-xs text-muted-foreground font-medium">Total</th>
              <th className="px-3 py-1.5 text-right text-xs text-muted-foreground font-medium">Realized P&L</th>
            </tr>
          </thead>
          <tbody>
            {visibleTrades.map((trade) => {
              const total = trade.quantity * trade.price;
              const pnl = trade.realized_pnl;
              const pnlColor =
                pnl == null ? "text-muted-foreground" : pnl >= 0 ? "text-green-400" : "text-red-400";
              const date = new Date(trade.executed_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <tr key={trade.id} className="border-b border-border hover:bg-muted/30">
                  <td className="px-3 py-1.5 text-xs text-muted-foreground tabular-nums">{date}</td>
                  <td className="px-3 py-1.5 font-mono font-semibold text-sm text-foreground">
                    {trade.ticker}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-xs font-medium uppercase ${
                      trade.side === "buy" ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {trade.side}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-sm text-right tabular-nums text-foreground">
                    {trade.quantity % 1 === 0 ? trade.quantity.toFixed(0) : trade.quantity.toFixed(4)}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-sm text-right tabular-nums text-muted-foreground">
                    ${trade.price.toFixed(2)}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-sm text-right tabular-nums text-foreground">
                    ${total.toFixed(2)}
                  </td>
                  <td className={`px-3 py-1.5 font-mono text-sm text-right tabular-nums ${pnlColor}`}>
                    {pnl == null
                      ? "—"
                      : `${pnl >= 0 ? "+$" : "-$"}${Math.abs(pnl).toFixed(2)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
