import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePriceStream } from "../usePriceStream";
import { usePriceStore } from "@/store/priceStore";

class MockEventSource {
  static instance: MockEventSource;
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instance = this;
  }

  triggerOpen() {
    this.onopen?.();
  }

  triggerMessage(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  triggerError() {
    this.onerror?.();
  }
}

beforeEach(() => {
  vi.stubGlobal("EventSource", MockEventSource);
  usePriceStore.setState({ prices: {}, history: {}, connectionStatus: "disconnected" });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("usePriceStream", () => {
  it("sets status to reconnecting on mount", () => {
    renderHook(() => usePriceStream());
    expect(usePriceStore.getState().connectionStatus).toBe("reconnecting");
  });

  it("sets status to connected on open", () => {
    renderHook(() => usePriceStream());
    MockEventSource.instance.triggerOpen();
    expect(usePriceStore.getState().connectionStatus).toBe("connected");
  });

  it("updates prices on valid message", () => {
    renderHook(() => usePriceStream());
    MockEventSource.instance.triggerOpen();
    MockEventSource.instance.triggerMessage({
      ticker: "AAPL",
      price: 191.5,
      prev_price: 191.0,
      prev_close: 189.0,
      change: 2.5,
      change_pct: 1.32,
      timestamp: 1000,
    });
    expect(usePriceStore.getState().prices["AAPL"]?.price).toBe(191.5);
  });

  it("ignores invalid messages", () => {
    renderHook(() => usePriceStream());
    MockEventSource.instance.triggerOpen();
    MockEventSource.instance.triggerMessage({ bad: "data" });
    expect(Object.keys(usePriceStore.getState().prices)).toHaveLength(0);
  });

  it("sets status to reconnecting on error and schedules retry", () => {
    renderHook(() => usePriceStream());
    MockEventSource.instance.triggerOpen();
    MockEventSource.instance.triggerError();
    expect(usePriceStore.getState().connectionStatus).toBe("reconnecting");
    expect(MockEventSource.instance.close).toHaveBeenCalled();
  });

  it("closes EventSource on unmount", () => {
    const { unmount } = renderHook(() => usePriceStream());
    const es = MockEventSource.instance;
    unmount();
    expect(es.close).toHaveBeenCalled();
  });
});
