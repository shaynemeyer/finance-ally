import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PLChart } from "../PLChart";
import { usePortfolioStore } from "@/store/portfolioStore";

// Recharts ResponsiveContainer uses ResizeObserver as a constructor; jsdom does not implement it
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const twoSnapshots = [
  { total_value: 10000, recorded_at: "2024-01-01T00:00:00Z" },
  { total_value: 10500, recorded_at: "2024-01-01T00:00:10Z" },
];

beforeEach(() => {
  usePortfolioStore.setState({ portfolio: null, history: [] });
});

describe("PLChart render", () => {
  it("shows empty state when history is empty", () => {
    render(<PLChart />);
    expect(screen.getByText("Collecting portfolio history...")).toBeInTheDocument();
  });

  it("shows empty state with exactly 1 snapshot", () => {
    usePortfolioStore.setState({ history: [twoSnapshots[0]] });
    render(<PLChart />);
    expect(screen.getByText("Collecting portfolio history...")).toBeInTheDocument();
  });

  it("does not show empty state when history has 2 or more snapshots", () => {
    // jsdom has no layout engine so Recharts renders no SVG, but the empty-state
    // element should be absent — confirming the chart branch was entered.
    usePortfolioStore.setState({ history: twoSnapshots });
    render(<PLChart />);
    expect(screen.queryByText("Collecting portfolio history...")).toBeNull();
  });
});
