"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { usePriceStore } from "@/store/priceStore";
import { useWatchlistStore } from "@/store/watchlistStore";
import { Sparkline } from "./Sparkline";

interface WatchlistRowProps {
  ticker: string;
}

const FLASH_DURATION_MS = 500;

export function WatchlistRow({ ticker }: WatchlistRowProps) {
  const priceData = usePriceStore((s) => s.prices[ticker]);
  const history = usePriceStore((s) => s.history[ticker] ?? []);
  const selectTicker = useWatchlistStore((s) => s.selectTicker);
  const selectedTicker = useWatchlistStore((s) => s.selectedTicker);
  const removeTicker = useWatchlistStore((s) => s.removeTicker);
  const rowRef = useRef<HTMLTableRowElement>(null);
  const prevPriceRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!priceData) return;
    const prev = prevPriceRef.current;
    prevPriceRef.current = priceData.price;
    if (prev === undefined || prev === priceData.price) return;

    const row = rowRef.current;
    if (!row) return;

    // Remove existing flash class, force reflow to restart animation, re-add
    const flashClass = priceData.direction === "up" ? "flash-up" : "flash-down";
    row.classList.remove("flash-up", "flash-down");
    void row.offsetHeight;
    row.classList.add(flashClass);

    const t = setTimeout(() => row.classList.remove(flashClass), FLASH_DURATION_MS);
    return () => clearTimeout(t);
  }, [priceData?.price, priceData?.direction]);

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await fetch(`/api/watchlist/${ticker}`, { method: "DELETE" });
    if (res.ok) removeTicker(ticker);
  };

  const isSelected = selectedTicker === ticker;
  const changePct = priceData?.changePct ?? null;
  const isPositive = changePct !== null && changePct >= 0;

  return (
    <tr
      ref={rowRef}
      className={`cursor-pointer border-b border-border transition-colors ${
        isSelected ? "bg-primary/20" : "hover:bg-muted/50"
      }`}
      onClick={() => selectTicker(ticker)}
    >
      <td className="px-3 py-2 font-mono font-semibold text-sm text-foreground">
        {ticker}
      </td>
      <td
        className={`px-3 py-2 font-mono text-sm text-right tabular-nums ${
          priceData?.direction === "up"
            ? "text-green-400"
            : priceData?.direction === "down"
              ? "text-red-400"
              : "text-foreground"
        }`}
      >
        {priceData ? `$${priceData.price.toFixed(2)}` : "—"}
      </td>
      <td
        className={`px-3 py-2 text-xs text-right tabular-nums ${
          changePct === null
            ? "text-muted-foreground"
            : isPositive
              ? "text-green-400"
              : "text-red-400"
        }`}
      >
        {changePct !== null
          ? `${isPositive ? "+" : ""}${changePct.toFixed(2)}%`
          : "—"}
      </td>
      <td className="px-3 py-2">
        <Sparkline data={history} />
      </td>
      <td className="px-3 py-2 text-right">
        <button
          onClick={handleRemove}
          className="text-muted-foreground hover:text-destructive transition-colors"
          aria-label={`Remove ${ticker}`}
        >
          <X className="w-3 h-3" />
        </button>
      </td>
    </tr>
  );
}
