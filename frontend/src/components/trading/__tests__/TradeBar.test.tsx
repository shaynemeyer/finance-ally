"use client";

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TradeBar } from "../TradeBar";
import { usePortfolioStore } from "@/store/portfolioStore";

const mockFetchPortfolio = vi.fn().mockResolvedValue(undefined);
const mockFetchHistory = vi.fn().mockResolvedValue(undefined);

vi.mock("@/store/portfolioStore", () => ({
  usePortfolioStore: vi.fn(() => ({
    fetchPortfolio: mockFetchPortfolio,
    fetchHistory: mockFetchHistory,
  })),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  mockFetchPortfolio.mockResolvedValue(undefined);
  mockFetchHistory.mockResolvedValue(undefined);
});

describe("TradeBar", () => {
  it("shows validation error when ticker is empty", async () => {
    render(<TradeBar />);
    fireEvent.click(screen.getByText("Buy"));
    expect(await screen.findByText("Enter a valid ticker and quantity")).toBeInTheDocument();
  });

  it("shows validation error when quantity is zero", async () => {
    render(<TradeBar />);
    fireEvent.change(screen.getByPlaceholderText("Ticker"), { target: { value: "AAPL" } });
    fireEvent.change(screen.getByPlaceholderText("Qty"), { target: { value: "0" } });
    fireEvent.click(screen.getByText("Buy"));
    expect(await screen.findByText("Enter a valid ticker and quantity")).toBeInTheDocument();
  });

  it("shows success message and refreshes portfolio on successful buy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ price: 200, quantity: 5 }),
    }));
    render(<TradeBar />);
    fireEvent.change(screen.getByPlaceholderText("Ticker"), { target: { value: "AAPL" } });
    fireEvent.change(screen.getByPlaceholderText("Qty"), { target: { value: "5" } });
    fireEvent.click(screen.getByText("Buy"));
    await waitFor(() => {
      expect(screen.getByText(/Bought 5 AAPL/)).toBeInTheDocument();
    });
    expect(mockFetchPortfolio).toHaveBeenCalled();
    expect(mockFetchHistory).toHaveBeenCalled();
  });

  it("shows API error message on failed trade", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Insufficient cash" }),
    }));
    render(<TradeBar />);
    fireEvent.change(screen.getByPlaceholderText("Ticker"), { target: { value: "AAPL" } });
    fireEvent.change(screen.getByPlaceholderText("Qty"), { target: { value: "999" } });
    fireEvent.click(screen.getByText("Buy"));
    await waitFor(() => {
      expect(screen.getByText("Insufficient cash")).toBeInTheDocument();
    });
  });

  it("re-enables button after network error (finally block)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    render(<TradeBar />);
    fireEvent.change(screen.getByPlaceholderText("Ticker"), { target: { value: "AAPL" } });
    fireEvent.change(screen.getByPlaceholderText("Qty"), { target: { value: "5" } });
    fireEvent.click(screen.getByText("Buy"));
    await waitFor(() => {
      expect(screen.getByText("Buy")).not.toBeDisabled();
      expect(screen.getByText("Trade failed")).toBeInTheDocument();
    });
  });
});
