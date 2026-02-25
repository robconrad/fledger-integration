import { test, expect } from "@playwright/test";
import { getAuthToken, WEB_URL } from "./support/api.js";
import { createAccountGroup, createAccountType, uniqueSuffix } from "./support/factories.js";
import { loginViaAPI, selectRowOptionByTyping, waitForOperationRequest, triggerDeleteAndWait } from "./support/browser.js";

test.describe("Web UI: Accounts CRUD", () => {
  let token: string;
  let groupName: string;
  let typeName: string;

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request);
  });

  test("create, read, update, delete account via UI", async ({ page, request }) => {
    // Setup prereqs via API
    const ag = await createAccountGroup(request, token);
    groupName = ag.name;
    const at = await createAccountType(request, token);
    typeName = at.name;

    // Login
    await loginViaAPI(page, request);

    // Navigate to accounts
    await page.goto(`${WEB_URL}/accounts`);
    await page.waitForLoadState("networkidle");

    // Create account
    const accountName = `ui-acc-${uniqueSuffix()}`;
    const headerRow = page.locator("thead tr").last();
    await headerRow.locator("input[placeholder='Name']").fill(accountName);
    await headerRow.locator("input[placeholder='Priority']").fill("999");

    // Select group and type via dropdowns
    await selectRowOptionByTyping(page, headerRow, 0, groupName);
    await selectRowOptionByTyping(page, headerRow, 1, typeName);

    const createRequest = waitForOperationRequest(page, "CreateAccount");
    await headerRow.getByRole("button", { name: /create/i }).click();
    await createRequest;

    // Verify row appears after reload
    await page.reload();
    await page.waitForLoadState("networkidle");
    const row = page.locator("tbody tr", { hasText: accountName });
    await expect(row).toBeVisible();

    // Update account
    const updatedName = `${accountName}-upd`;
    await row.locator("td").first().dblclick();
    const nameInput = row.locator("input[type='text']").first();
    await nameInput.clear();
    await nameInput.fill(updatedName);
    const updateRequest = waitForOperationRequest(page, "UpdateAccount");
    await row.getByRole("button", { name: /update/i }).click();
    await updateRequest;

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("tbody tr", { hasText: updatedName })).toBeVisible();

    // Delete account
    const updatedRow = page.locator("tbody tr", { hasText: updatedName });
    await triggerDeleteAndWait(page, updatedRow, "DeleteAccount");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("tbody tr", { hasText: updatedName })).not.toBeVisible();
  });
});
