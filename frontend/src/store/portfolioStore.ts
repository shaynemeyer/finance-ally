import { create } from "zustand";
import { z } from "zod";
import { Portfolio, PortfolioSchema, Snapshot, SnapshotSchema } from "@/types/portfolio";

interface PortfolioState {
  portfolio: Portfolio | null;
  history: Snapshot[];
  fetchPortfolio: () => Promise<void>;
  fetchHistory: () => Promise<void>;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  portfolio: null,
  history: [],

  fetchPortfolio: async () => {
    const res = await fetch("/api/portfolio");
    if (!res.ok) return;
    const data = PortfolioSchema.parse(await res.json());
    set({ portfolio: data });
  },

  fetchHistory: async () => {
    const res = await fetch("/api/portfolio/history");
    if (!res.ok) return;
    const data = z.array(SnapshotSchema).parse(await res.json());
    set({ history: data });
  },
}));
