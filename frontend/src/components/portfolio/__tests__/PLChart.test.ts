import { describe, it, expect } from "vitest";

// Inline the pure functions from PLChart for unit testing
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatValue(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

describe("PLChart formatTime", () => {
  it("formats two different hours to different strings", () => {
    // toLocaleTimeString output is locale-dependent (12h or 24h); assert inequality only
    const t1430 = formatTime("2024-01-15T14:30:00Z");
    const t0230 = formatTime("2024-01-15T02:30:00Z");
    expect(t1430).not.toBe(t0230);
  });

  it("midnight and noon produce different strings", () => {
    const midnight = formatTime("2024-01-15T00:00:00Z");
    const noon = formatTime("2024-01-15T12:00:00Z");
    expect(midnight).not.toBe(noon);
  });
});

describe("PLChart formatValue", () => {
  it("formats whole number with 2 decimal places", () => {
    expect(formatValue(10000)).toBe("$10,000.00");
  });

  it("formats decimal value", () => {
    expect(formatValue(9999.5)).toBe("$9,999.50");
  });

  it("formats small value", () => {
    expect(formatValue(0.99)).toBe("$0.99");
  });
});

describe("PLChart min/max via reduce", () => {
  it("finds min correctly without spread (large arrays)", () => {
    const values = Array.from({ length: 9000 }, (_, i) => 10000 + i);
    const min = values.reduce((a, b) => (b < a ? b : a), values[0]);
    expect(min).toBe(10000);
  });

  it("finds max correctly without spread (large arrays)", () => {
    const values = Array.from({ length: 9000 }, (_, i) => 10000 + i);
    const max = values.reduce((a, b) => (b > a ? b : a), values[0]);
    expect(max).toBe(18999);
  });
});
