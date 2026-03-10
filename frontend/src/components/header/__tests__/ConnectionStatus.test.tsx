import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConnectionStatus } from "../ConnectionStatus";
import { usePriceStore } from "@/store/priceStore";

beforeEach(() => {
  usePriceStore.setState({ connectionStatus: "disconnected" });
});

describe("ConnectionStatus", () => {
  it("shows disconnected by default", () => {
    render(<ConnectionStatus />);
    expect(screen.getByText("disconnected")).toBeInTheDocument();
  });

  it("shows connected status", () => {
    usePriceStore.setState({ connectionStatus: "connected" });
    render(<ConnectionStatus />);
    expect(screen.getByText("connected")).toBeInTheDocument();
  });

  it("shows reconnecting status", () => {
    usePriceStore.setState({ connectionStatus: "reconnecting" });
    render(<ConnectionStatus />);
    expect(screen.getByText("reconnecting")).toBeInTheDocument();
  });

  it("dot has green class when connected", () => {
    usePriceStore.setState({ connectionStatus: "connected" });
    const { container } = render(<ConnectionStatus />);
    const dot = container.querySelector("[aria-label='connected']");
    expect(dot?.className).toContain("bg-green-400");
  });

  it("dot has red class when disconnected", () => {
    usePriceStore.setState({ connectionStatus: "disconnected" });
    const { container } = render(<ConnectionStatus />);
    const dot = container.querySelector("[aria-label='disconnected']");
    expect(dot?.className).toContain("bg-red-500");
  });
});
