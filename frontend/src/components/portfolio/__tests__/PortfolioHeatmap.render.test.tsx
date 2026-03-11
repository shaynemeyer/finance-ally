import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PortfolioHeatmap } from "../PortfolioHeatmap";
import { usePortfolioStore } from "@/store/portfolioStore";

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mockPortfolio = {
  cash_balance: 8000,
  total_value: 10000,
  positions: [
    {
      ticker: "AAPL",
      quantity: 10,
      avg_cost: 180,
      current_price: 200,
      value: 2000,
      unrealized_pnl: 200,
      unrealized_pnl_pct: 11.1,
    },
  ],
};

beforeEach(() => {
  usePortfolioStore.setState({ portfolio: null, history: [] });
});

describe("PortfolioHeatmap render", () => {
  it("shows 'No positions' when portfolio is null", () => {
    render(<PortfolioHeatmap />);
    expect(screen.getByText("No positions")).toBeInTheDocument();
  });

  it("shows 'No positions' when positions array is empty", () => {
    usePortfolioStore.setState({ portfolio: { ...mockPortfolio, positions: [] } });
    render(<PortfolioHeatmap />);
    expect(screen.getByText("No positions")).toBeInTheDocument();
  });

  it("renders without throwing when positions exist", () => {
    usePortfolioStore.setState({ portfolio: mockPortfolio });
    expect(() => render(<PortfolioHeatmap />)).not.toThrow();
    expect(screen.queryByText("No positions")).toBeNull();
  });
});
