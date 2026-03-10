import { describe, it, expect, beforeEach } from "vitest";
import { useWatchlistStore } from "../watchlistStore";

beforeEach(() => {
  useWatchlistStore.setState({ tickers: [], selectedTicker: null });
});

describe("watchlistStore", () => {
  it("setTickers replaces tickers list", () => {
    useWatchlistStore.getState().setTickers(["AAPL", "GOOGL"]);
    expect(useWatchlistStore.getState().tickers).toEqual(["AAPL", "GOOGL"]);
  });

  it("addTicker appends a new ticker", () => {
    useWatchlistStore.getState().addTicker("AAPL");
    expect(useWatchlistStore.getState().tickers).toContain("AAPL");
  });

  it("addTicker ignores duplicates", () => {
    useWatchlistStore.getState().addTicker("AAPL");
    useWatchlistStore.getState().addTicker("AAPL");
    expect(useWatchlistStore.getState().tickers.filter((t) => t === "AAPL").length).toBe(1);
  });

  it("removeTicker removes a ticker", () => {
    useWatchlistStore.getState().setTickers(["AAPL", "GOOGL"]);
    useWatchlistStore.getState().removeTicker("AAPL");
    expect(useWatchlistStore.getState().tickers).not.toContain("AAPL");
    expect(useWatchlistStore.getState().tickers).toContain("GOOGL");
  });

  it("removeTicker clears selectedTicker if it was the removed one", () => {
    useWatchlistStore.getState().setTickers(["AAPL"]);
    useWatchlistStore.getState().selectTicker("AAPL");
    useWatchlistStore.getState().removeTicker("AAPL");
    expect(useWatchlistStore.getState().selectedTicker).toBeNull();
  });

  it("removeTicker keeps selectedTicker if different ticker removed", () => {
    useWatchlistStore.getState().setTickers(["AAPL", "GOOGL"]);
    useWatchlistStore.getState().selectTicker("AAPL");
    useWatchlistStore.getState().removeTicker("GOOGL");
    expect(useWatchlistStore.getState().selectedTicker).toBe("AAPL");
  });

  it("selectTicker updates selectedTicker", () => {
    useWatchlistStore.getState().selectTicker("TSLA");
    expect(useWatchlistStore.getState().selectedTicker).toBe("TSLA");
  });
});
