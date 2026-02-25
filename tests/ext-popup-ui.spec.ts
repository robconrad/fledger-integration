import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { isExtensionAvailable, launchExtensionContext } from "./support/extension.js";
import { getAuthToken } from "./support/api.js";
import {
  createAccountGroup,
  createAccountType,
  createAccount,
} from "./support/factories.js";

test.skip(!isExtensionAvailable(), "Extension not built — run: cd ../fledger-chrome && npm run build");

test.describe("Chrome Extension: Popup UI", () => {
  let context: BrowserContext;
  let extensionId: string;
  let cleanup: () => void;

  test.beforeAll(async ({ request }) => {
    const ext = await launchExtensionContext();
    context = ext.context;
    extensionId = ext.extensionId;
    cleanup = ext.cleanup;

    // Create test account for popup to display
    const token = await getAuthToken(request);
    const ag = await createAccountGroup(request, token);
    const at = await createAccountType(request, token);
    await createAccount(request, token, { account_group_id: ag.id, account_type_id: at.id });

    // Login via options page
    const optionsPage = await context.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/src/options.html`);
    await optionsPage.waitForLoadState("domcontentloaded");
    const usernameInput = optionsPage.locator("input").nth(0);
    const passwordInput = optionsPage.locator("input[type='password']");
    await usernameInput.fill("fledger");
    await passwordInput.fill("fledger-local");
    await optionsPage.getByRole("button", { name: "Login" }).click();
    await expect(optionsPage.locator("#status")).toContainText("Logged in", { timeout: 10_000 });
    await optionsPage.close();
  });

  test.afterAll(async () => {
    try {
      await context?.close();
    } finally {
      cleanup?.();
    }
  });

  test("popup page loads and shows accounts", async () => {
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup.html`);
    await popupPage.waitForLoadState("domcontentloaded");

    // The popup should render — wait for content to load from the API
    await expect(popupPage.locator("body")).not.toBeEmpty();

    // Wait for the popup to fetch accounts and render meaningful content
    await expect(async () => {
      const bodyText = await popupPage.locator("body").textContent();
      expect(bodyText!.length).toBeGreaterThan(10);
    }).toPass({ timeout: 10_000 });

    await popupPage.close();
  });

  test("popup shows authenticated state", async () => {
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup.html`);
    await popupPage.waitForLoadState("domcontentloaded");

    // Since we logged in via options page, the popup should show authenticated state
    // Wait for the popup to load and check auth state
    await expect(async () => {
      const bodyText = await popupPage.locator("body").textContent();
      expect(bodyText!.length).toBeGreaterThan(0);
    }).toPass({ timeout: 5_000 });

    // Login button should NOT be visible (already authenticated via shared chrome.storage)
    const loginButton = popupPage.getByRole("button", { name: "Login" });
    await expect(loginButton).not.toBeVisible({ timeout: 5000 });

    await popupPage.close();
  });
});
