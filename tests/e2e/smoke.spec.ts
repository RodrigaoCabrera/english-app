import { test, expect } from "@playwright/test";

test("home page renders the hero and CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /read, hover,\s*speak fluently/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /start reading/i })).toBeVisible();
});

test("unknown route shows the 404 page", async ({ page }) => {
  await page.goto("/this-route-does-not-exist");
  await expect(page.getByRole("heading", { name: /page not found/i })).toBeVisible();
});

test("visiting a protected route while signed out redirects to sign-in", async ({ page }) => {
  await page.goto("/reading");
  await expect(page).toHaveURL(/sign-in|accounts\.|clerk/i);
});
