import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Sparkline } from "../Sparkline";

describe("Sparkline", () => {
  it("renders an SVG element", () => {
    const { container } = render(<Sparkline data={[100, 101, 102]} />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders empty SVG when fewer than 2 data points", () => {
    const { container } = render(<Sparkline data={[100]} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.querySelector("polyline")).toBeNull();
  });

  it("renders a polyline when enough data", () => {
    const { container } = render(<Sparkline data={[100, 101, 102, 99]} />);
    expect(container.querySelector("polyline")).toBeTruthy();
  });

  it("uses green color when price trended up", () => {
    const { container } = render(<Sparkline data={[100, 105]} />);
    const line = container.querySelector("polyline");
    expect(line?.getAttribute("stroke")).toBe("#22c55e");
  });

  it("uses red color when price trended down", () => {
    const { container } = render(<Sparkline data={[105, 100]} />);
    const line = container.querySelector("polyline");
    expect(line?.getAttribute("stroke")).toBe("#ef4444");
  });

  it("uses default width and height", () => {
    const { container } = render(<Sparkline data={[100, 101]} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("80");
    expect(svg?.getAttribute("height")).toBe("28");
  });

  it("uses custom width and height", () => {
    const { container } = render(<Sparkline data={[100, 101]} width={120} height={40} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("120");
    expect(svg?.getAttribute("height")).toBe("40");
  });
});
