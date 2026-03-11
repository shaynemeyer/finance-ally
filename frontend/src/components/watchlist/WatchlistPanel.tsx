"use client";

import { useEffect, useState } from "react";
import { useWatchlistStore } from "@/store/watchlistStore";
import { WatchlistItem, WatchlistItemSchema } from "@/types/market";
import { WatchlistRow } from "./WatchlistRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { z } from "zod";

export function WatchlistPanel() {
  const { tickers, setTickers, addTicker } = useWatchlistStore();
  const [inputValue, setInputValue] = useState("");
  const [addError, setAddError] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetch("/api/watchlist")
      .then((r) => {
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const items = z.array(WatchlistItemSchema).parse(data) as WatchlistItem[];
        setTickers(items.map((i) => i.ticker));
      })
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : "Failed to load watchlist");
      });
  }, [setTickers]);

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const ticker = inputValue.trim().toUpperCase();
    if (!ticker) return;
    setIsAdding(true);
    setAddError("");

    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker }),
    });

    setIsAdding(false);
    if (res.ok) {
      addTicker(ticker);
      setInputValue("");
    } else if (res.status === 409) {
      setAddError("Already in watchlist");
    } else {
      setAddError("Failed to add ticker");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Watchlist
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {fetchError ? (
          <p className="px-3 py-4 text-xs text-destructive">{fetchError}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-2 py-1.5 text-left text-xs text-muted-foreground font-medium">
                  Ticker
                </th>
                <th className="px-2 py-1.5 text-right text-xs text-muted-foreground font-medium">
                  Price
                </th>
                <th className="px-2 py-1.5 text-right text-xs text-muted-foreground font-medium">
                  Chg%
                </th>
                <th className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                  Chart
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tickers.map((ticker) => (
                <WatchlistRow key={ticker} ticker={ticker} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="px-3 py-2 border-t border-border">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value.toUpperCase());
              setAddError("");
            }}
            placeholder="Ticker..."
            className="h-7 text-xs uppercase font-mono"
            maxLength={10}
          />
          <Button
            type="submit"
            size="sm"
            className="h-7 text-xs"
            disabled={isAdding || !inputValue.trim()}
          >
            Add
          </Button>
        </form>
        {addError && (
          <p className="text-xs text-destructive mt-1">{addError}</p>
        )}
      </div>
    </div>
  );
}
