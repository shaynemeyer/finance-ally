import { describe, it, expect } from "vitest";

// Test the fractional quantity display logic from PositionsTable
function formatQuantity(qty: number): string {
  return qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(4);
}

describe("PositionsTable quantity display", () => {
  it("shows whole number quantities without decimals", () => {
    expect(formatQuantity(10)).toBe("10");
    expect(formatQuantity(1)).toBe("1");
    expect(formatQuantity(100)).toBe("100");
  });

  it("shows fractional quantities with 4 decimal places", () => {
    expect(formatQuantity(0.5)).toBe("0.5000");
    expect(formatQuantity(1.25)).toBe("1.2500");
    expect(formatQuantity(0.0001)).toBe("0.0001");
  });
});
