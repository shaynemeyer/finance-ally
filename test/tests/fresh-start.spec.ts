import { test, expect } from "@playwright/test";

const DEFAULT_TICKERS = [
  "AAPL",
  "GOOGL",
  "MSFT",
  "AMZN",
  "TSLA",
  "NVDA",
  "META",
  "JPM",
  "V",
  "NFLX",
];

test("fresh start: default watchlist of 10 tickers visible", async ({
  page,
}) => {
  await page.goto("/");

  for (const ticker of DEFAULT_TICKERS) {
    await expect(
      page.getByRole("cell", { name: ticker, exact: true })
    ).toBeVisible({ timeout: 10_000 });
  }
});

test("fresh start: cash balance shows $10,000.00", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("$10,000.00")).toBeVisible({ timeout: 10_000 });
});

test("fresh start: SSE connection becomes connected", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("connected")).toBeVisible({ timeout: 15_000 });
});

test("fresh start: prices are streaming in watchlist", async ({ page }) => {
  await page.goto("/");

  // Wait for SSE to connect
  await expect(page.getByText("connected")).toBeVisible({ timeout: 15_000 });

  // At least one price cell in the watchlist table should show a dollar amount
  await expect(
    page.locator("table tbody td").filter({ hasText: /^\$\d+\.\d{2}$/ }).first()
  ).toBeVisible({ timeout: 10_000 });
});
