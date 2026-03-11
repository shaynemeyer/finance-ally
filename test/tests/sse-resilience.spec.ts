import { test, expect } from "@playwright/test";

test("SSE resilience: status shows connected on load", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("connected")).toBeVisible({ timeout: 15_000 });
});

test("SSE resilience: status changes on disconnect then reconnects", async ({
  page,
  context,
}) => {
  await page.goto("/");

  // Wait for initial connection
  await expect(page.getByText("connected")).toBeVisible({ timeout: 15_000 });

  // Simulate network offline — cuts the SSE connection
  await context.setOffline(true);

  // EventSource onerror fires -> status changes to reconnecting
  await expect(
    page.getByText(/reconnecting|disconnected/)
  ).toBeVisible({ timeout: 10_000 });

  // Restore network — EventSource will retry after 3s delay
  await context.setOffline(false);

  // Should reconnect and show connected again
  await expect(page.getByText("connected")).toBeVisible({ timeout: 20_000 });
});

test("SSE resilience: prices resume updating after reconnect", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.getByText("connected")).toBeVisible({ timeout: 15_000 });

  // Capture a price value before disconnect
  const firstPriceCell = page
    .locator("table tbody td")
    .filter({ hasText: /^\$\d+\.\d{2}$/ })
    .first();
  await expect(firstPriceCell).toBeVisible({ timeout: 10_000 });

  // Go offline and back online
  await context.setOffline(true);
  await expect(page.getByText(/reconnecting|disconnected/)).toBeVisible({
    timeout: 10_000,
  });
  await context.setOffline(false);

  // Wait for reconnection
  await expect(page.getByText("connected")).toBeVisible({ timeout: 20_000 });

  // Prices should still be visible (stream resumed)
  await expect(firstPriceCell).toBeVisible({ timeout: 5_000 });
});
