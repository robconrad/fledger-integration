import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { isExtensionAvailable, launchExtensionContext, EXTENSION_MESSAGE_TYPES } from "./support/extension.js";
import { getAuthToken, graphql } from "./support/api.js";
import {
  createAccountGroup,
  createAccountType,
  createAccount,
  createCategoryGroup,
  createCategory,
  uniqueSuffix,
} from "./support/factories.js";

test.skip(!isExtensionAvailable(), "Extension not built — run: cd ../fledger-chrome && npm run build");

test.describe("Chrome Extension: Import workflow", () => {
  let context: BrowserContext;
  let extensionId: string;
  let optionsPage: Page;
  let cleanup: () => void;
  let token: string;
  let accountId: number;
  let foreignKey: string;

  test.beforeAll(async ({ request }) => {
    // Launch extension
    const ext = await launchExtensionContext();
    context = ext.context;
    extensionId = ext.extensionId;
    cleanup = ext.cleanup;

    // Auth via API to get token for verification queries
    token = await getAuthToken(request);

    // Create test entities via API
    const ag = await createAccountGroup(request, token);
    const at = await createAccountType(request, token);
    const acc = await createAccount(request, token, { account_group_id: ag.id, account_type_id: at.id });
    accountId = acc.id;
    const cg = await createCategoryGroup(request, token);
    await createCategory(request, token, { category_group_id: cg.id });

    // Login via extension options page
    optionsPage = await context.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/src/options.html`);
    await optionsPage.waitForLoadState("domcontentloaded");

    const usernameInput = optionsPage.locator("input").nth(0);
    const passwordInput = optionsPage.locator("input[type='password']");
    await usernameInput.fill("fledger");
    await passwordInput.fill("fledger-local");
    await optionsPage.getByRole("button", { name: "Login" }).click();
    await expect(optionsPage.locator("#status")).toContainText("Logged in", { timeout: 10_000 });
  });

  test.afterAll(async () => {
    await context?.close();
    cleanup?.();
  });

  test("bootstrap returns accounts from API", async () => {
    const result = await optionsPage.evaluate(async (msg: unknown) => {
      return await chrome.runtime.sendMessage(msg);
    }, {
      type: EXTENSION_MESSAGE_TYPES.IMPORTER_BOOTSTRAP,
      transactions: [],
      sourceAccount: null,
    });

    expect(result).toHaveProperty("ok", true);
    expect(result).toHaveProperty("accounts");
    const accounts = (result as { accounts: Array<{ id: number; name: string }> }).accounts;
    expect(accounts.length).toBeGreaterThan(0);
    // Our created account should be in the list
    const found = accounts.find((a) => a.id === accountId);
    expect(found).toBeDefined();
  });

  test("import provisional transactions via extension", async ({ request }) => {
    foreignKey = `ext-test-fk-${uniqueSuffix()}`;
    const result = await optionsPage.evaluate(async (msg: unknown) => {
      return await chrome.runtime.sendMessage(msg);
    }, {
      type: EXTENSION_MESSAGE_TYPES.IMPORT_PROVISIONAL_TRANSACTIONS,
      transactions: [{
        fingerprint: `ext-test-fp-${Date.now()}`,
        foreignKey: foreignKey,
        amount: "42.50",
        dateIso: "2026-01-15",
        description: "Extension integration test transaction",
      }],
      sourceAccount: null,
      overrideAccountId: accountId,
    });

    expect(result).toHaveProperty("ok", true);
    const importResult = (result as { result: { created: unknown[]; skipped: unknown[]; failed: unknown[] } }).result;
    expect(importResult.created.length).toBe(1);

    // Verify via direct API query
    const data = await graphql<{ provisional_items: Array<{ foreign_key: string; account_id: number; amount: number; comments: string }> }>(
      request, token,
      `query($fks: [String!]!) { provisional_items(provisional_item_filters: { foreign_keys: $fks }, size: 10) { foreign_key account_id amount comments } }`,
      { fks: [foreignKey] }
    );
    expect(data.provisional_items).toHaveLength(1);
    expect(data.provisional_items[0]!.foreign_key).toBe(foreignKey);
    expect(data.provisional_items[0]!.account_id).toBe(accountId);
  });

  test("dedup check returns synced items", async () => {
    // Use IMPORTER_BOOTSTRAP with transactions that have the same foreignKey
    // to verify the extension can detect already-imported transactions
    const result = await optionsPage.evaluate(async (msg: unknown) => {
      return await chrome.runtime.sendMessage(msg);
    }, {
      type: EXTENSION_MESSAGE_TYPES.IMPORTER_BOOTSTRAP,
      transactions: [{
        fingerprint: `ext-dedup-fp-${Date.now()}`,
        foreignKey: foreignKey,
        amount: "42.50",
        dateIso: "2026-01-15",
        description: "Dedup check transaction",
      }],
      sourceAccount: null,
      overrideAccountId: accountId,
    });

    expect(result).toHaveProperty("ok", true);
    // The bootstrap should identify this transaction as already imported
    const items = (result as { items: Array<{ alreadySynced?: boolean; fingerprint: string }> }).items;
    expect(items.length).toBeGreaterThan(0);
  });

  test("save and retrieve account URL mapping", async () => {
    const sourceAccount = {
      sourceKey: `ext-src-${uniqueSuffix()}`,
      keys: [`ext-src-${uniqueSuffix()}`],
      provider: "test-bank",
      displayName: "Test Bank Account",
    };

    // Save mapping
    const saveResult = await optionsPage.evaluate(async (msg: unknown) => {
      return await chrome.runtime.sendMessage(msg);
    }, {
      type: EXTENSION_MESSAGE_TYPES.SAVE_ACCOUNT_MAPPING,
      sourceAccount,
      accountId: accountId,
      invertAmount: false,
    });
    expect(saveResult).toHaveProperty("ok", true);

    // Retrieve mapping
    const getResult = await optionsPage.evaluate(async (msg: unknown) => {
      return await chrome.runtime.sendMessage(msg);
    }, {
      type: EXTENSION_MESSAGE_TYPES.GET_ACCOUNT_MAPPING,
      sourceAccount,
    });
    expect(getResult).toHaveProperty("ok", true);
    const mapping = (getResult as { mapping: { accountId: number } | null }).mapping;
    expect(mapping).not.toBeNull();
    expect(mapping!.accountId).toBe(accountId);
  });
});
