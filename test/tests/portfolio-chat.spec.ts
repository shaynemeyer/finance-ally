import { test, expect } from "@playwright/test";

test("portfolio heatmap shows 'No positions' before any trades", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("connected")).toBeVisible({ timeout: 15_000 });

  await expect(page.getByText("No positions")).toBeVisible({ timeout: 5_000 });
});

test("portfolio heatmap renders after buying shares", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("connected")).toBeVisible({ timeout: 15_000 });

  // Buy shares
  await page.getByPlaceholder("Ticker", { exact: true }).fill("AAPL");
  await page.getByPlaceholder("Qty").fill("10");
  await page.getByRole("button", { name: "Buy" }).click();
  await expect(page.getByText(/Bought 10 AAPL/)).toBeVisible({
    timeout: 10_000,
  });

  // "No positions" placeholder should be gone
  await expect(page.getByText("No positions")).not.toBeVisible({
    timeout: 5_000,
  });
});

test("P&L chart renders after two trades create snapshots", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("connected")).toBeVisible({ timeout: 15_000 });

  // First trade creates snapshot 1
  await page.getByPlaceholder("Ticker", { exact: true }).fill("AAPL");
  await page.getByPlaceholder("Qty").fill("10");
  await page.getByRole("button", { name: "Buy" }).click();
  await expect(page.getByText(/Bought 10 AAPL/)).toBeVisible({
    timeout: 10_000,
  });

  // Second trade creates snapshot 2 -> chart needs >= 2 data points
  await page.getByPlaceholder("Ticker", { exact: true }).fill("AAPL");
  await page.getByPlaceholder("Qty").fill("5");
  await page.getByRole("button", { name: "Sell" }).click();
  await expect(page.getByText(/Sold 5 AAPL/)).toBeVisible({ timeout: 10_000 });

  // PLChart placeholder should be gone; SVG chart should render
  await expect(page.getByText("Collecting portfolio history...")).not.toBeVisible({
    timeout: 5_000,
  });
});

test("AI chat: send message, see loading indicator, receive mock response", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("connected")).toBeVisible({ timeout: 15_000 });

  // Type and send a message
  const chatInput = page.getByPlaceholder("Ask Finance Ally...");
  await chatInput.fill("What's in my portfolio?");
  await page.getByRole("button", { name: "Send" }).click();

  // Loading indicator should appear
  await expect(page.getByText("Thinking...")).toBeVisible({ timeout: 5_000 });

  // Mock LLM response should appear
  await expect(
    page.getByText("I can help you analyze your portfolio.")
  ).toBeVisible({ timeout: 15_000 });
});

