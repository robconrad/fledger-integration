import { test, expect } from "@playwright/test";
import { getAuthToken, WEB_URL } from "./support/api.js";
import {
  createAccountGroup,
  createAccountType,
  createAccount,
  createCategoryGroup,
  createCategory,
  createItem,
  uniqueSuffix,
} from "./support/factories.js";
import { loginViaAPI, waitForOperationResponse, triggerDeleteAndWait } from "./support/browser.js";

test.describe("Web UI: Items CRUD", () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request);
  });

  test("read, update, delete item via UI", async ({ page, request }) => {
    // Setup prereqs and create item via API
    // (MUI DatePicker in the create form is not automatable with standard fill)
    const ag = await createAccountGroup(request, token);
    const at = await createAccountType(request, token);
    const acc = await createAccount(request, token, { account_group_id: ag.id, account_type_id: at.id });
    const cg = await createCategoryGroup(request, token);
    const cat = await createCategory(request, token, { category_group_id: cg.id });
    const comments = `ui-item-${uniqueSuffix()}`;
    const today = new Date().toISOString().split("T")[0]!;
    await createItem(request, token, {
      account_id: acc.id,
      category_id: cat.id,
      amount: 4250,
      date: today,
      comments,
    });

    // Login
    await loginViaAPI(page, request);

    // Navigate to items and verify item appears
    await page.goto(`${WEB_URL}/items`);
    await page.waitForLoadState("networkidle");
    const row = page.locator("tbody tr", { hasText: comments });
    await expect(row).toBeVisible({ timeout: 15_000 });

    // Update item — dblclick the comments cell to enter edit mode
    const updatedComments = `${comments}-upd`;
    await row.locator("td", { hasText: comments }).dblclick();

    // After dblclick, InlineEdit replaces row content with edit form.
    // Locate via tbody scope since row locator becomes stale.
    const commentsInput = page.locator("tbody input[placeholder='Comments']");
    await expect(commentsInput).toBeVisible({ timeout: 5_000 });
    await commentsInput.clear();
    await commentsInput.fill(updatedComments);
    const editRow = commentsInput.locator("xpath=ancestor::tr");
    const updateDone = waitForOperationResponse(page, "UpdateItem");
    await editRow.getByRole("button", { name: /update/i }).click();
    await updateDone;

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("tbody tr", { hasText: updatedComments })).toBeVisible({ timeout: 15_000 });

    // Delete item
    const updatedRow = page.locator("tbody tr", { hasText: updatedComments });
    await triggerDeleteAndWait(page, updatedRow, "DeleteItem");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("tbody tr", { hasText: updatedComments })).not.toBeVisible();
  });
});
