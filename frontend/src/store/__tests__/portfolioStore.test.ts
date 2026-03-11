import { describe, it, expect, beforeEach, vi } from "vitest";
import { usePortfolioStore } from "../portfolioStore";

const mockPortfolio = {
  cash_balance: 8000,
  total_value: 10500,
  positions: [
    {
      ticker: "AAPL",
      quantity: 10,
      avg_cost: 190,
      current_price: 200,
      value: 2000,
      unrealized_pnl: 100,
      unrealized_pnl_pct: 5.26,
    },
  ],
};

const mockHistory = [
  { total_value: 10000, recorded_at: "2024-01-01T00:00:00Z" },
  { total_value: 10500, recorded_at: "2024-01-01T00:00:10Z" },
];

beforeEach(() => {
  usePortfolioStore.setState({ portfolio: null, history: [] });
  vi.restoreAllMocks();
});

describe("portfolioStore.fetchPortfolio", () => {
  it("sets portfolio on successful fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPortfolio,
    }));
    await usePortfolioStore.getState().fetchPortfolio();
    expect(usePortfolioStore.getState().portfolio).toMatchObject({ cash_balance: 8000, total_value: 10500 });
  });

  it("does not update state when response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await usePortfolioStore.getState().fetchPortfolio();
    expect(usePortfolioStore.getState().portfolio).toBeNull();
  });

  it("does not update state when response fails Zod parse", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: "shape" }),
    }));
    await usePortfolioStore.getState().fetchPortfolio();
    expect(usePortfolioStore.getState().portfolio).toBeNull();
  });

  it("sets portfolio to null when fetch rejects (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    await usePortfolioStore.getState().fetchPortfolio();
    expect(usePortfolioStore.getState().portfolio).toBeNull();
  });
});

describe("portfolioStore.fetchHistory", () => {
  it("sets history on successful fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockHistory,
    }));
    await usePortfolioStore.getState().fetchHistory();
    expect(usePortfolioStore.getState().history).toHaveLength(2);
    expect(usePortfolioStore.getState().history[0].total_value).toBe(10000);
  });

  it("does not update state when response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await usePortfolioStore.getState().fetchHistory();
    expect(usePortfolioStore.getState().history).toEqual([]);
  });

  it("does not update state when response fails Zod parse", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ bad: "data" }],
    }));
    await usePortfolioStore.getState().fetchHistory();
    expect(usePortfolioStore.getState().history).toEqual([]);
  });

  it("sets history to empty array when fetch rejects (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    await usePortfolioStore.getState().fetchHistory();
    expect(usePortfolioStore.getState().history).toEqual([]);
  });
});
