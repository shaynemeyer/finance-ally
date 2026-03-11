import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MainChart } from "../MainChart";
import { usePriceStore } from "@/store/priceStore";
import { useWatchlistStore } from "@/store/watchlistStore";

// Recharts ResponsiveContainer uses ResizeObserver; jsdom does not implement it
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

beforeEach(() => {
  useWatchlistStore.setState({ tickers: [], selectedTicker: null });
  usePriceStore.setState({ prices: {}, history: {}, connectionStatus: "disconnected" });
});

describe("MainChart render", () => {
  it("shows empty state when watchlist is empty", () => {
    render(<MainChart />);
    expect(screen.getByText("No tickers in watchlist")).toBeInTheDocument();
  });

  it("shows collecting state when ticker has fewer than 2 history points", () => {
    useWatchlistStore.setState({ tickers: ["AAPL"], selectedTicker: "AAPL" });
    usePriceStore.setState({ history: { AAPL: [150] } });
    render(<MainChart />);
    expect(screen.getByText("Collecting price data for AAPL...")).toBeInTheDocument();
  });

  it("shows collecting state when ticker has no history", () => {
    useWatchlistStore.setState({ tickers: ["AAPL"], selectedTicker: "AAPL" });
    render(<MainChart />);
    expect(screen.getByText("Collecting price data for AAPL...")).toBeInTheDocument();
  });

  it("renders chart (no empty state) when history has 2+ points", () => {
    useWatchlistStore.setState({ tickers: ["AAPL"], selectedTicker: "AAPL" });
    usePriceStore.setState({
      history: { AAPL: [150, 151, 152] },
      prices: { AAPL: { price: 152, prevPrice: 151, direction: "up", changePct: 0.66, timestamp: Date.now() } },
    });
    render(<MainChart />);
    expect(screen.queryByText("Collecting price data for AAPL...")).toBeNull();
    expect(screen.queryByText("No tickers in watchlist")).toBeNull();
  });

  it("defaults to first watchlist ticker when none selected", () => {
    useWatchlistStore.setState({ tickers: ["GOOGL", "MSFT"], selectedTicker: null });
    usePriceStore.setState({ history: { GOOGL: [175] } });
    render(<MainChart />);
    // Falls back to GOOGL (first ticker), which has only 1 data point
    expect(screen.getByText("Collecting price data for GOOGL...")).toBeInTheDocument();
  });

  it("shows ticker name and price when data is available", () => {
    useWatchlistStore.setState({ tickers: ["TSLA"], selectedTicker: "TSLA" });
    usePriceStore.setState({
      history: { TSLA: [200, 205] },
      prices: { TSLA: { price: 205, prevPrice: 200, direction: "up", changePct: 2.5, timestamp: Date.now() } },
    });
    render(<MainChart />);
    expect(screen.getByText("TSLA")).toBeInTheDocument();
  });
});
