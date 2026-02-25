import { test, expect } from "@playwright/test";
import { getAuthToken, WEB_URL } from "./support/api.js";
import {
  createAccountGroup,
  createAccountType,
  createAccount,
  createCategoryGroup,
  createCategory,
  uniqueSuffix,
} from "./support/factories.js";
import { loginViaAPI, selectRowOptionByTyping, waitForOperationRequest, triggerDeleteAndWait } from "./support/browser.js";

test.describe("Web UI: Items CRUD", () => {
  let token: string;
  let accountName: string;
  let categoryName: string;

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request);
  });

  test("create, read, update, delete item via UI", async ({ page, request }) => {
    // Setup prereqs via API
    const ag = await createAccountGroup(request, token);
    const at = await createAccountType(request, token);
    const acc = await createAccount(request, token, { account_group_id: ag.id, account_type_id: at.id });
    accountName = acc.name;
    const cg = await createCategoryGroup(request, token);
    const cat = await createCategory(request, token, { category_group_id: cg.id });
    categoryName = cat.name;

    // Login
    await loginViaAPI(page, request);

    // Navigate to items
    await page.goto(`${WEB_URL}/items`);
    await page.waitForLoadState("networkidle");

    // Create item
    const comments = `ui-item-${uniqueSuffix()}`;
    const headerRow = page.locator("thead tr").last();
    await headerRow.locator("input[placeholder='Comments']").fill(comments);
    await headerRow.locator("input[placeholder='Amount']").fill("42.50");

    // Select account and category via dropdowns
    await selectRowOptionByTyping(page, headerRow, 0, accountName);
    await selectRowOptionByTyping(page, headerRow, 1, categoryName);

    const createRequest = waitForOperationRequest(page, "CreateItem");
    await headerRow.getByRole("button", { name: /create/i }).click();
    await createRequest;

    // Verify item appears after reload
    await page.reload();
    await page.waitForLoadState("networkidle");
    const row = page.locator("tbody tr", { hasText: comments });
    await expect(row).toBeVisible();

    // Update item
    const updatedComments = `${comments}-upd`;
    await row.locator("td", { hasText: comments }).dblclick();
    const commentsInput = row.locator("input[type='text']").first();
    await commentsInput.clear();
    await commentsInput.fill(updatedComments);
    const updateRequest = waitForOperationRequest(page, "UpdateItem");
    await row.getByRole("button", { name: /update/i }).click();
    await updateRequest;

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("tbody tr", { hasText: updatedComments })).toBeVisible();

    // Delete item
    const updatedRow = page.locator("tbody tr", { hasText: updatedComments });
    await triggerDeleteAndWait(page, updatedRow, "DeleteItem");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("tbody tr", { hasText: updatedComments })).not.toBeVisible();
  });
});
