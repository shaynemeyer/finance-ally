"use client";

import { useState } from "react";
import { usePortfolioStore } from "@/store/portfolioStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TradeBar() {
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState("");
  const [lastTrade, setLastTrade] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { fetchPortfolio, fetchHistory } = usePortfolioStore();

  const executeTrade = async (side: "buy" | "sell") => {
    const t = ticker.trim().toUpperCase();
    const qty = parseFloat(quantity);
    if (!t || isNaN(qty) || qty <= 0) {
      setError("Enter a valid ticker and quantity");
      return;
    }
    setError("");
    setLastTrade(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/portfolio/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: t, quantity: qty, side }),
      });

      if (res.ok) {
        const data = await res.json();
        const total = (data.price * data.quantity).toFixed(2);
        setLastTrade(`${side === "buy" ? "Bought" : "Sold"} ${qty} ${t} @ $${data.price.toFixed(2)} = $${total}`);
        setTicker("");
        setQuantity("");
        await Promise.all([fetchPortfolio(), fetchHistory()]);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.detail ?? "Trade failed");
      }
    } catch {
      setError("Trade failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          value={ticker}
          onChange={(e) => { setTicker(e.target.value.toUpperCase()); setError(""); setLastTrade(null); }}
          placeholder="Ticker"
          className="h-7 text-xs font-mono uppercase w-24"
          maxLength={10}
          disabled={isSubmitting}
        />
        <Input
          value={quantity}
          onChange={(e) => { setQuantity(e.target.value); setError(""); setLastTrade(null); }}
          placeholder="Qty"
          type="number"
          min="0.0001"
          step="any"
          className="h-7 text-xs font-mono w-24"
          disabled={isSubmitting}
        />
        <Button
          size="sm"
          className="h-7 text-xs bg-secondary hover:bg-secondary/80 text-secondary-foreground"
          onClick={() => executeTrade("buy")}
          disabled={isSubmitting}
        >
          Buy
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="h-7 text-xs"
          onClick={() => executeTrade("sell")}
          disabled={isSubmitting}
        >
          Sell
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {lastTrade && <p className="text-xs text-green-400">{lastTrade}</p>}
    </div>
  );
}
