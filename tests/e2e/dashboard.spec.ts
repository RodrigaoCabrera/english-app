import { test, expect } from "@playwright/test";

test("visiting /dashboard while signed out redirects to sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/sign-in|accounts\.|clerk/i);
});
