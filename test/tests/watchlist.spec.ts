import { test, expect } from "@playwright/test";

test("add a ticker to the watchlist", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("connected")).toBeVisible({ timeout: 15_000 });

  // Add PYPL
  await page.getByPlaceholder("Ticker...").fill("PYPL");
  await page.getByRole("button", { name: "Add" }).click();

  // Verify PYPL appears in watchlist
  await expect(
    page.getByRole("cell", { name: "PYPL", exact: true })
  ).toBeVisible({ timeout: 5_000 });
});

test("remove a ticker from the watchlist", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("connected")).toBeVisible({ timeout: 15_000 });

  // Add PYPL first
  await page.getByPlaceholder("Ticker...").fill("PYPL");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(
    page.getByRole("cell", { name: "PYPL", exact: true })
  ).toBeVisible({ timeout: 5_000 });

  // Remove PYPL via aria-label button
  await page.getByRole("button", { name: "Remove PYPL" }).click();

  // Verify PYPL is gone
  await expect(
    page.getByRole("cell", { name: "PYPL", exact: true })
  ).not.toBeVisible({ timeout: 5_000 });
});

test("add duplicate ticker shows error", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("connected")).toBeVisible({ timeout: 15_000 });

  // AAPL is already in the default watchlist — try to add it again
  await page.getByPlaceholder("Ticker...").fill("AAPL");
  await page.getByRole("button", { name: "Add" }).click();

  await expect(page.getByText("Already in watchlist")).toBeVisible({
    timeout: 5_000,
  });
});
