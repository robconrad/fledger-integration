import { test, expect } from "@playwright/test";
import { getAuthToken, WEB_URL } from "./support/api.js";
import {
  createAccountGroup,
  createAccountType,
  createAccount,
  createCategoryGroup,
  createCategory,
  createItem,
} from "./support/factories.js";
import { loginViaAPI } from "./support/browser.js";

test.describe("Web UI: Navigation", () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request);
    // Create test data
    const ag = await createAccountGroup(request, token);
    const at = await createAccountType(request, token);
    const acc = await createAccount(request, token, { account_group_id: ag.id, account_type_id: at.id });
    const cg = await createCategoryGroup(request, token);
    const cat = await createCategory(request, token, { category_group_id: cg.id });
    await createItem(request, token, { account_id: acc.id, category_id: cat.id, amount: 5000, date: "2025-01-15" });
  });

  test("overview page renders with data", async ({ page, request }) => {
    await loginViaAPI(page, request);
    await page.goto(`${WEB_URL}/`);
    await page.waitForLoadState("networkidle");
    // Overview should show account groups or summary data
    await expect(page.locator(".OverviewTableHeader").first()).toBeVisible({ timeout: 15_000 });
  });

  test("slices page loads", async ({ page, request }) => {
    await loginViaAPI(page, request);
    await page.goto(`${WEB_URL}/slices`);
    // Should redirect to default slice view
    await expect(page).toHaveURL(/\/slices\//, { timeout: 10_000 });
    await expect(page.locator(".SliceTable").first()).toBeVisible({ timeout: 15_000 });
  });

  test("normalization page loads", async ({ page, request }) => {
    await loginViaAPI(page, request);
    await page.goto(`${WEB_URL}/normalization`);
    await expect(page.locator(".NormalizationPeriods").first()).toBeVisible({ timeout: 15_000 });
  });
});
