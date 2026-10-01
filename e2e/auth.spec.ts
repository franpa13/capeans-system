import { test, expect } from "@playwright/test";

test("unauthenticated user is redirected to sign-in when visiting the dashboard", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/sign-in/);
});
