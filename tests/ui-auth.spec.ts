import { test, expect } from "@playwright/test";
import { WEB_URL } from "./support/api.js";
import { loginViaUI } from "./support/browser.js";

test.describe("Web UI: Authentication", () => {
  test("login via UI form", async ({ page }) => {
    await loginViaUI(page);
    await expect(page).toHaveURL(/\//);
    await expect(page.getByRole("link", { name: "Logout" })).toBeVisible();
    const token = await page.evaluate(() =>
      window.localStorage.getItem("fledgerAuthToken")
    );
    expect(token).not.toBeNull();
  });

  test("protected route redirects to login", async ({ page }) => {
    await page.goto(`${WEB_URL}/items`);
    await expect(page).toHaveURL(/\/login/);
  });

  test("logout clears token", async ({ page }) => {
    await loginViaUI(page);
    await page.getByRole("link", { name: "Logout" }).click();
    await expect(page).toHaveURL(/\/login/);
    const token = await page.evaluate(() =>
      window.localStorage.getItem("fledgerAuthToken")
    );
    expect(token).toBeNull();
  });
});
