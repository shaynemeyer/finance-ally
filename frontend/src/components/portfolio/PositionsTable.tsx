"use client";

import { usePortfolioStore } from "@/store/portfolioStore";

export function PositionsTable() {
  const portfolio = usePortfolioStore((s) => s.portfolio);

  if (!portfolio || portfolio.positions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        No open positions
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-background border-b border-border">
          <tr>
            <th className="px-3 py-1.5 text-left text-xs text-muted-foreground font-medium">Ticker</th>
            <th className="px-3 py-1.5 text-right text-xs text-muted-foreground font-medium">Qty</th>
            <th className="px-3 py-1.5 text-right text-xs text-muted-foreground font-medium">Avg Cost</th>
            <th className="px-3 py-1.5 text-right text-xs text-muted-foreground font-medium">Price</th>
            <th className="px-3 py-1.5 text-right text-xs text-muted-foreground font-medium">Value</th>
            <th className="px-3 py-1.5 text-right text-xs text-muted-foreground font-medium">P&L</th>
            <th className="px-3 py-1.5 text-right text-xs text-muted-foreground font-medium">P&L%</th>
          </tr>
        </thead>
        <tbody>
          {portfolio.positions.map((pos) => {
            const isProfit = pos.unrealized_pnl >= 0;
            const pnlColor = isProfit ? "text-green-400" : "text-red-400";
            return (
              <tr key={pos.ticker} className="border-b border-border hover:bg-muted/30">
                <td className="px-3 py-1.5 font-mono font-semibold text-sm text-foreground">
                  {pos.ticker}
                </td>
                <td className="px-3 py-1.5 font-mono text-sm text-right tabular-nums text-foreground">
                  {pos.quantity % 1 === 0 ? pos.quantity.toFixed(0) : pos.quantity.toFixed(4)}
                </td>
                <td className="px-3 py-1.5 font-mono text-sm text-right tabular-nums text-muted-foreground">
                  ${pos.avg_cost.toFixed(2)}
                </td>
                <td className="px-3 py-1.5 font-mono text-sm text-right tabular-nums text-foreground">
                  ${pos.current_price.toFixed(2)}
                </td>
                <td className="px-3 py-1.5 font-mono text-sm text-right tabular-nums text-foreground">
                  ${pos.value.toFixed(2)}
                </td>
                <td className={`px-3 py-1.5 font-mono text-sm text-right tabular-nums ${pnlColor}`}>
                  {isProfit ? "+" : ""}${pos.unrealized_pnl.toFixed(2)}
                </td>
                <td className={`px-3 py-1.5 font-mono text-sm text-right tabular-nums ${pnlColor}`}>
                  {isProfit ? "+" : ""}{pos.unrealized_pnl_pct.toFixed(2)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
