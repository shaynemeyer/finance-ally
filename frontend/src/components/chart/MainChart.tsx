"use client";

import {
  LineChart,
  Line,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { usePriceStore } from "@/store/priceStore";
import { useWatchlistStore } from "@/store/watchlistStore";

function formatPrice(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function MainChart() {
  const tickers = useWatchlistStore((s) => s.tickers);
  const selectedTicker = useWatchlistStore((s) => s.selectedTicker);
  const prices = usePriceStore((s) => s.prices);
  const history = usePriceStore((s) => s.history);

  const ticker = selectedTicker ?? tickers[0] ?? null;

  if (!ticker) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        No tickers in watchlist
      </div>
    );
  }

  const priceHistory = history[ticker] ?? [];
  const currentPrice = prices[ticker]?.price ?? null;

  if (priceHistory.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        Collecting price data for {ticker}...
      </div>
    );
  }

  const data = priceHistory.map((value, i) => ({ i, value }));
  const firstValue = data[0].value;
  const lastValue = data[data.length - 1].value;
  const isUp = lastValue >= firstValue;
  const change = lastValue - firstValue;
  const changePct = firstValue !== 0 ? (change / firstValue) * 100 : 0;

  const values = priceHistory;
  const min = values.reduce((a, b) => (b < a ? b : a), values[0]);
  const max = values.reduce((a, b) => (b > a ? b : a), values[0]);
  const pad = (max - min) * 0.1 || 1;

  const lineColor = isUp ? "#22c55e" : "#ef4444";
  const changeColor = isUp ? "text-green-500" : "text-red-500";
  const changeSign = isUp ? "+" : "";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-baseline gap-3 px-3 pt-2 pb-1 shrink-0">
        <span className="text-sm font-bold text-foreground">{ticker}</span>
        {currentPrice !== null && (
          <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
            {formatPrice(currentPrice)}
          </span>
        )}
        <span className={`font-mono text-xs tabular-nums ${changeColor}`}>
          {changeSign}{formatPrice(Math.abs(change))} ({changeSign}{changePct.toFixed(2)}%)
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
            <YAxis
              domain={[min - pad, max + pad]}
              tick={{ fill: "#8b949e", fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
              width={44}
            />
            <Tooltip
              contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 4 }}
              labelStyle={{ display: "none" }}
              itemStyle={{ color: "#e6edf3", fontSize: 11 }}
              formatter={(v: number) => [formatPrice(v), ticker]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: lineColor }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
