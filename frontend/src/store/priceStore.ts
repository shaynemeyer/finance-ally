import { create } from "zustand";
import { PriceEvent } from "@/types/market";

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

export interface PriceData {
  price: number;
  prevPrice: number;
  direction: "up" | "down" | "flat";
  changePct: number;
  timestamp: number;
}

interface PriceState {
  prices: Record<string, PriceData>;
  history: Record<string, number[]>;
  connectionStatus: ConnectionStatus;
  setPrice: (event: PriceEvent) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
}

const MAX_HISTORY = 100;

export const usePriceStore = create<PriceState>((set) => ({
  prices: {},
  history: {},
  connectionStatus: "disconnected",

  setPrice: (event) =>
    set((state) => {
      const direction =
        event.price > event.prev_price
          ? "up"
          : event.price < event.prev_price
            ? "down"
            : "flat";
      const prevHistory = state.history[event.ticker] ?? [];
      return {
        prices: {
          ...state.prices,
          [event.ticker]: {
            price: event.price,
            prevPrice: event.prev_price,
            direction,
            changePct: event.change_pct,
            timestamp: event.timestamp,
          },
        },
        history: {
          ...state.history,
          [event.ticker]: [...prevHistory, event.price].slice(-MAX_HISTORY),
        },
      };
    }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),
}));
