import { test, expect } from "@playwright/test";

// Smoke tests for the critical navigation paths. These hit a live dev server
// (see playwright.config.ts webServer) but do NOT trigger paid AI calls.

test("home page renders the hero and CTA", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /read, hover,\s*speak fluently/i })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /start reading/i })).toBeVisible();
});

test("navigates from home to the reading list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /start reading/i }).click();
  await expect(page).toHaveURL(/\/reading$/);
  await expect(
    page.getByRole("heading", { name: "Reading", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /generate/i }).first()).toBeVisible();
});

test("opens and closes the generate modal", async ({ page }) => {
  await page.goto("/reading");
  await page.getByRole("button", { name: "+ Generate" }).click();
  await expect(
    page.getByRole("heading", { name: /generate new reading/i })
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.getByRole("heading", { name: /generate new reading/i })
  ).toBeHidden();
});

test("unknown route shows the 404 page", async ({ page }) => {
  await page.goto("/this-route-does-not-exist");
  await expect(
    page.getByRole("heading", { name: /page not found/i })
  ).toBeVisible();
});
