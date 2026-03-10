import { describe, it, expect, beforeEach } from "vitest";
import { usePriceStore } from "../priceStore";
import { PriceEvent } from "@/types/market";

const baseEvent: PriceEvent = {
  ticker: "AAPL",
  price: 191.5,
  prev_price: 191.0,
  prev_close: 189.0,
  change: 2.5,
  change_pct: 1.32,
  timestamp: 1000,
};

beforeEach(() => {
  usePriceStore.setState({ prices: {}, history: {}, connectionStatus: "disconnected" });
});

describe("priceStore.setPrice", () => {
  it("stores price data for a ticker", () => {
    usePriceStore.getState().setPrice(baseEvent);
    const { prices } = usePriceStore.getState();
    expect(prices["AAPL"]).toMatchObject({
      price: 191.5,
      prevPrice: 191.0,
      direction: "up",
      changePct: 1.32,
    });
  });

  it("direction is down when price drops", () => {
    usePriceStore.getState().setPrice({ ...baseEvent, price: 190.0, prev_price: 191.0 });
    expect(usePriceStore.getState().prices["AAPL"].direction).toBe("down");
  });

  it("direction is flat when price unchanged", () => {
    usePriceStore.getState().setPrice({ ...baseEvent, price: 191.0, prev_price: 191.0 });
    expect(usePriceStore.getState().prices["AAPL"].direction).toBe("flat");
  });

  it("accumulates price history", () => {
    usePriceStore.getState().setPrice({ ...baseEvent, price: 100 });
    usePriceStore.getState().setPrice({ ...baseEvent, price: 101, prev_price: 100 });
    usePriceStore.getState().setPrice({ ...baseEvent, price: 102, prev_price: 101 });
    expect(usePriceStore.getState().history["AAPL"]).toEqual([100, 101, 102]);
  });

  it("caps history at 100 entries", () => {
    const store = usePriceStore.getState();
    for (let i = 0; i < 110; i++) {
      store.setPrice({ ...baseEvent, price: 100 + i, prev_price: 99 + i });
    }
    expect(usePriceStore.getState().history["AAPL"].length).toBe(100);
  });

  it("tracks multiple tickers independently", () => {
    usePriceStore.getState().setPrice(baseEvent);
    usePriceStore.getState().setPrice({ ...baseEvent, ticker: "GOOGL", price: 175.0, prev_price: 174.0 });
    const { prices } = usePriceStore.getState();
    expect(prices["AAPL"].price).toBe(191.5);
    expect(prices["GOOGL"].price).toBe(175.0);
  });
});

describe("priceStore.setConnectionStatus", () => {
  it("updates connection status", () => {
    usePriceStore.getState().setConnectionStatus("connected");
    expect(usePriceStore.getState().connectionStatus).toBe("connected");
  });
});
