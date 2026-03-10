import { create } from "zustand";

interface WatchlistState {
  tickers: string[];
  selectedTicker: string | null;
  setTickers: (tickers: string[]) => void;
  addTicker: (ticker: string) => void;
  removeTicker: (ticker: string) => void;
  selectTicker: (ticker: string) => void;
}

export const useWatchlistStore = create<WatchlistState>((set) => ({
  tickers: [],
  selectedTicker: null,

  setTickers: (tickers) => set({ tickers }),

  addTicker: (ticker) =>
    set((state) => ({
      tickers: state.tickers.includes(ticker)
        ? state.tickers
        : [...state.tickers, ticker],
    })),

  removeTicker: (ticker) =>
    set((state) => ({
      tickers: state.tickers.filter((t) => t !== ticker),
      selectedTicker:
        state.selectedTicker === ticker ? null : state.selectedTicker,
    })),

  selectTicker: (ticker) => set({ selectedTicker: ticker }),
}));
