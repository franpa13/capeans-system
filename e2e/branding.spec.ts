import { test, expect } from "@playwright/test";

test("the app is branded as Dentia, not Capeans", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page).toHaveTitle(/Dentia/);
  const bodyText = await page.textContent("body");
  expect(bodyText).not.toContain("Capeans");
});
