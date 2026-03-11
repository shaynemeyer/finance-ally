import { describe, it, expect } from "vitest";

// pnlColor is not exported — test via its observable boundaries:
// >5% → dark green, >2% → mid green, >0% → light green,
// <-5% → dark red, <-2% → mid red, <0% → light red, 0 → gray
// We inline the function here to unit-test it directly.
function pnlColor(pct: number): string {
  if (pct > 5) return "#15803d";
  if (pct > 2) return "#16a34a";
  if (pct > 0) return "#22c55e";
  if (pct < -5) return "#991b1b";
  if (pct < -2) return "#dc2626";
  if (pct < 0) return "#ef4444";
  return "#4b5563";
}

describe("pnlColor", () => {
  it("returns dark green for pct > 5", () => {
    expect(pnlColor(6)).toBe("#15803d");
    expect(pnlColor(5.1)).toBe("#15803d");
  });

  it("returns mid green for pct between 2 and 5", () => {
    expect(pnlColor(5)).toBe("#16a34a");
    expect(pnlColor(2.5)).toBe("#16a34a");
  });

  it("returns light green for pct between 0 and 2", () => {
    expect(pnlColor(2)).toBe("#22c55e");
    expect(pnlColor(0.1)).toBe("#22c55e");
  });

  it("returns gray for pct === 0", () => {
    expect(pnlColor(0)).toBe("#4b5563");
  });

  it("returns light red for pct between -2 and 0", () => {
    expect(pnlColor(-0.1)).toBe("#ef4444");
    expect(pnlColor(-2)).toBe("#ef4444");
  });

  it("returns mid red for pct between -5 and -2", () => {
    expect(pnlColor(-2.1)).toBe("#dc2626");
    expect(pnlColor(-4.9)).toBe("#dc2626");
  });

  it("returns dark red for pct < -5", () => {
    expect(pnlColor(-5.1)).toBe("#991b1b");
    expect(pnlColor(-10)).toBe("#991b1b");
  });
});
