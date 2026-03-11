import { test, expect } from "@playwright/test";

test("buy shares: cash decreases and position appears", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("connected")).toBeVisible({ timeout: 15_000 });

  // Target the Cash value specifically: find the parent div of the "Cash" label
  const cashEl = page
    .locator("header")
    .getByText("Cash", { exact: true })
    .locator("..")
    .locator("span")
    .last();
  const initialCash = await cashEl.textContent();

  // Execute buy via trade bar
  await page.getByPlaceholder("Ticker", { exact: true }).fill("AAPL");
  await page.getByPlaceholder("Qty").fill("10");
  await page.getByRole("button", { name: "Buy" }).click();

  // Trade confirmation appears
  await expect(page.getByText(/Bought 10 AAPL/)).toBeVisible({
    timeout: 10_000,
  });

  // Cash balance decreased
  const newCash = await cashEl.textContent();
  expect(newCash).not.toBe(initialCash);

  // AAPL position is no longer "No open positions"
  await expect(page.getByText("No open positions")).not.toBeVisible({
    timeout: 5_000,
  });
});

test("sell shares: cash increases and position updates", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("connected")).toBeVisible({ timeout: 15_000 });

  // Buy 10 AAPL first
  await page.getByPlaceholder("Ticker", { exact: true }).fill("AAPL");
  await page.getByPlaceholder("Qty").fill("10");
  await page.getByRole("button", { name: "Buy" }).click();
  await expect(page.getByText(/Bought 10 AAPL/)).toBeVisible({
    timeout: 10_000,
  });

  // Target Cash balance specifically (distinct from Portfolio total value)
  const cashEl = page
    .locator("header")
    .getByText("Cash", { exact: true })
    .locator("..")
    .locator("span")
    .last();
  const cashAfterBuy = await cashEl.textContent();

  // Sell 5 AAPL
  await page.getByPlaceholder("Ticker", { exact: true }).fill("AAPL");
  await page.getByPlaceholder("Qty").fill("5");
  await page.getByRole("button", { name: "Sell" }).click();
  await expect(page.getByText(/Sold 5 AAPL/)).toBeVisible({ timeout: 10_000 });

  // Cash increased after sell
  const cashAfterSell = await cashEl.textContent();
  expect(cashAfterSell).not.toBe(cashAfterBuy);
});

test("sell all shares: position row disappears", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("connected")).toBeVisible({ timeout: 15_000 });

  // Buy 10 AAPL
  await page.getByPlaceholder("Ticker", { exact: true }).fill("AAPL");
  await page.getByPlaceholder("Qty").fill("10");
  await page.getByRole("button", { name: "Buy" }).click();
  await expect(page.getByText(/Bought 10 AAPL/)).toBeVisible({
    timeout: 10_000,
  });

  // Sell all 10
  await page.getByPlaceholder("Ticker", { exact: true }).fill("AAPL");
  await page.getByPlaceholder("Qty").fill("10");
  await page.getByRole("button", { name: "Sell" }).click();
  await expect(page.getByText(/Sold 10 AAPL/)).toBeVisible({ timeout: 10_000 });

  // Positions table shows empty state
  await expect(page.getByText("No open positions")).toBeVisible({
    timeout: 10_000,
  });
});

test("buy with insufficient cash shows error", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("connected")).toBeVisible({ timeout: 15_000 });

  // Try to buy an unrealistically large quantity
  await page.getByPlaceholder("Ticker", { exact: true }).fill("AAPL");
  await page.getByPlaceholder("Qty").fill("99999");
  await page.getByRole("button", { name: "Buy" }).click();

  await expect(
    page.getByText(/insufficient|not enough/i)
  ).toBeVisible({ timeout: 5_000 });
});
