"use client";

import { useState } from "react";
import { PositionsTable } from "@/components/portfolio/PositionsTable";
import { TradeHistoryTable } from "@/components/portfolio/TradeHistoryTable";

interface Props {
  selectedYear: number | undefined;
  onYearChange: (year: number | undefined) => void;
}

export function PositionsTabs({ selectedYear, onYearChange }: Props) {
  const [activeTab, setActiveTab] = useState<"positions" | "trades">("positions");

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      <div className="flex border-b border-border shrink-0">
        <button
          onClick={() => setActiveTab("positions")}
          className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${
            activeTab === "positions"
              ? "text-foreground border-b-2 border-accent"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Positions
        </button>
        <button
          onClick={() => setActiveTab("trades")}
          className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${
            activeTab === "trades"
              ? "text-foreground border-b-2 border-accent"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Trade History
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === "positions" ? (
          <PositionsTable />
        ) : (
          <TradeHistoryTable selectedYear={selectedYear} onYearChange={onYearChange} />
        )}
      </div>
    </div>
  );
}
