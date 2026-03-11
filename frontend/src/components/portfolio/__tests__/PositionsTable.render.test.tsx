import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PositionsTable } from "../PositionsTable";
import { usePortfolioStore } from "@/store/portfolioStore";

const makePortfolio = (positions: object[]) => ({
  cash_balance: 8000,
  total_value: 10000,
  positions,
});

const profitPosition = {
  ticker: "AAPL",
  quantity: 5,
  avg_cost: 180,
  current_price: 200,
  value: 1000,
  unrealized_pnl: 100,
  unrealized_pnl_pct: 11.1,
};

const lossPosition = {
  ticker: "TSLA",
  quantity: 3,
  avg_cost: 250,
  current_price: 200,
  value: 600,
  unrealized_pnl: -150,
  unrealized_pnl_pct: -20,
};

beforeEach(() => {
  usePortfolioStore.setState({ portfolio: null, history: [] });
});

describe("PositionsTable render", () => {
  it("shows 'No open positions' when portfolio is null", () => {
    render(<PositionsTable />);
    expect(screen.getByText("No open positions")).toBeInTheDocument();
  });

  it("shows 'No open positions' when positions array is empty", () => {
    usePortfolioStore.setState({ portfolio: makePortfolio([]) });
    render(<PositionsTable />);
    expect(screen.getByText("No open positions")).toBeInTheDocument();
  });

  it("renders ticker for each position", () => {
    usePortfolioStore.setState({ portfolio: makePortfolio([profitPosition]) });
    render(<PositionsTable />);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
  });

  it("applies green color class for profitable position", () => {
    usePortfolioStore.setState({ portfolio: makePortfolio([profitPosition]) });
    const { container } = render(<PositionsTable />);
    expect(container.querySelector(".text-green-400")).toBeTruthy();
  });

  it("applies red color class for losing position", () => {
    usePortfolioStore.setState({ portfolio: makePortfolio([lossPosition]) });
    const { container } = render(<PositionsTable />);
    expect(container.querySelector(".text-red-400")).toBeTruthy();
  });

  it("formats negative P&L as -$amount not $-amount", () => {
    usePortfolioStore.setState({ portfolio: makePortfolio([lossPosition]) });
    render(<PositionsTable />);
    expect(screen.getByText("-$150.00")).toBeInTheDocument();
  });
});
