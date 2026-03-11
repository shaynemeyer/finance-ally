import { create } from "zustand";
import { z } from "zod";
import {
  Portfolio,
  PortfolioSchema,
  Snapshot,
  SnapshotSchema,
  Trade,
  TradeHistorySchema,
} from "@/types/portfolio";

interface PortfolioState {
  portfolio: Portfolio | null;
  history: Snapshot[];
  trades: Trade[];
  aggregateRealizedPnl: number;
  fetchPortfolio: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  fetchTrades: () => Promise<void>;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  portfolio: null,
  history: [],
  trades: [],
  aggregateRealizedPnl: 0,

  fetchPortfolio: async () => {
    try {
      const res = await fetch("/api/portfolio");
      if (!res.ok) return;
      const data = PortfolioSchema.parse(await res.json());
      set({ portfolio: data });
    } catch {
      set({ portfolio: null });
    }
  },

  fetchHistory: async () => {
    try {
      const res = await fetch("/api/portfolio/history");
      if (!res.ok) return;
      const data = z.array(SnapshotSchema).parse(await res.json());
      set({ history: data });
    } catch {
      set({ history: [] });
    }
  },

  fetchTrades: async () => {
    try {
      const res = await fetch("/api/portfolio/trades");
      if (!res.ok) return;
      const data = TradeHistorySchema.parse(await res.json());
      set({ trades: data.trades, aggregateRealizedPnl: data.aggregate_realized_pnl });
    } catch {
      set({ trades: [], aggregateRealizedPnl: 0 });
    }
  },
}));
