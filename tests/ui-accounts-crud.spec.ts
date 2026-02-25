import { test, expect } from "@playwright/test";
import { getAuthToken, WEB_URL } from "./support/api.js";
import { createAccountGroup, createAccountType, uniqueSuffix } from "./support/factories.js";
import { loginViaAPI, selectRowOptionByTyping, waitForOperationResponse, triggerDeleteAndWait } from "./support/browser.js";

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

    const createDone = waitForOperationResponse(page, "CreateAccount");
    await headerRow.getByRole("button", { name: /create/i }).click();
    await createDone;

    // Verify row appears after reload
    await page.reload();
    await page.waitForLoadState("networkidle");
    const row = page.locator("tbody tr", { hasText: accountName });
    await expect(row).toBeVisible({ timeout: 15_000 });

    // Update account — dblclick the name cell to enter edit mode
    const updatedName = `${accountName}-upd`;
    await row.locator("td", { hasText: accountName }).first().dblclick();

    // After dblclick, InlineEdit replaces row content with edit form.
    // The original row locator (hasText) becomes stale since the name
    // moves from text content into an input value. Locate via tbody scope.
    const nameInput = page.locator("tbody input[placeholder='Name']");
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.clear();
    await nameInput.fill(updatedName);
    const editRow = nameInput.locator("xpath=ancestor::tr");
    const updateDone = waitForOperationResponse(page, "UpdateAccount");
    await editRow.getByRole("button", { name: /update/i }).click();
    await updateDone;

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("tbody tr", { hasText: updatedName })).toBeVisible({ timeout: 15_000 });

    // Delete account
    const updatedRow = page.locator("tbody tr", { hasText: updatedName });
    await triggerDeleteAndWait(page, updatedRow, "DeleteAccount");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("tbody tr", { hasText: updatedName })).not.toBeVisible();
  });
});
