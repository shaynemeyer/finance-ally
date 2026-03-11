import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TradeHistoryTable } from "../TradeHistoryTable";
import { usePortfolioStore } from "@/store/portfolioStore";

const makeTrade = (overrides: object = {}) => ({
  id: "trade-1",
  ticker: "AAPL",
  side: "sell",
  quantity: 5,
  price: 150.0,
  realized_pnl: 50.0,
  executed_at: "2026-03-11T12:00:00+00:00",
  ...overrides,
});

beforeEach(() => {
  usePortfolioStore.setState({
    trades: [],
    aggregateRealizedPnl: 0,
  });
});

describe("TradeHistoryTable render", () => {
  it("shows 'No trades yet' when trades list is empty", () => {
    render(<TradeHistoryTable />);
    expect(screen.getByText("No trades yet")).toBeInTheDocument();
  });

  it("renders ticker for a sell trade", () => {
    usePortfolioStore.setState({ trades: [makeTrade()] });
    render(<TradeHistoryTable />);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
  });

  it("renders realized P&L as +$amount for profitable sell", () => {
    usePortfolioStore.setState({ trades: [makeTrade({ realized_pnl: 50.0 })] });
    render(<TradeHistoryTable />);
    expect(screen.getByText("+$50.00")).toBeInTheDocument();
  });

  it("renders realized P&L as -$amount for losing sell", () => {
    usePortfolioStore.setState({ trades: [makeTrade({ realized_pnl: -75.0 })] });
    render(<TradeHistoryTable />);
    expect(screen.getByText("-$75.00")).toBeInTheDocument();
  });

  it("renders dash for buy trade with null realized P&L", () => {
    usePortfolioStore.setState({ trades: [makeTrade({ side: "buy", realized_pnl: null })] });
    render(<TradeHistoryTable />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("applies red color class for sell side", () => {
    usePortfolioStore.setState({ trades: [makeTrade({ side: "sell" })] });
    const { container } = render(<TradeHistoryTable />);
    expect(container.querySelector(".text-red-400")).toBeTruthy();
  });

  it("applies green color for profitable realized P&L", () => {
    usePortfolioStore.setState({ trades: [makeTrade({ realized_pnl: 100 })] });
    const { container } = render(<TradeHistoryTable />);
    expect(container.querySelector(".text-green-400")).toBeTruthy();
  });
});
