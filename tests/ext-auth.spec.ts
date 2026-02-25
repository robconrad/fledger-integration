import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { isExtensionAvailable, launchExtensionContext } from "./support/extension.js";

test.skip(!isExtensionAvailable(), "Extension not built — run: cd ../fledger-chrome && npm run build");

test.describe("Chrome Extension: Authentication", () => {
  let context: BrowserContext;
  let extensionId: string;
  let cleanup: () => void;
  let optionsPage: Page;

  test.beforeAll(async () => {
    const ext = await launchExtensionContext();
    context = ext.context;
    extensionId = ext.extensionId;
    cleanup = ext.cleanup;
    // Create a single shared page for all tests — persistent contexts
    // can auto-close when all pages are closed, so reuse one page
    optionsPage = await context.newPage();
  });

  test.afterAll(async () => {
    try {
      await context?.close();
    } finally {
      cleanup?.();
    }
  });

  async function navigateToOptions(): Promise<void> {
    await optionsPage.goto(`chrome-extension://${extensionId}/src/options.html`);
    await optionsPage.waitForLoadState("domcontentloaded");
  }

  test("extension options page loads", async () => {
    await navigateToOptions();

    // Verify the page rendered
    await expect(optionsPage.locator("h1")).toContainText("Fledger Importer");

    // Verify endpoint selector has dev option
    const select = optionsPage.locator("select[name='graphqlEndpoint']");
    await expect(select).toBeVisible();
  });

  test("login and logout via extension options page", async () => {
    await navigateToOptions();

    // Fill auth credentials — the AuthSection has username and password inputs
    const usernameInput = optionsPage.locator("input").nth(0);
    const passwordInput = optionsPage.locator("input[type='password']");
    await usernameInput.fill("fledger");
    await passwordInput.fill("fledger-local");

    // Click Login
    await optionsPage.getByRole("button", { name: "Login" }).click();

    // Wait for status to show logged in
    await expect(optionsPage.locator("#status")).toContainText("Logged in", { timeout: 30_000 });

    // Logout button should now be visible
    await expect(optionsPage.getByRole("button", { name: "Logout" })).toBeVisible();

    // Now test logout
    await optionsPage.getByRole("button", { name: "Logout" }).click();
    await expect(optionsPage.locator("#status")).toContainText("Logged out", { timeout: 10_000 });

    // Login button should reappear
    await expect(optionsPage.getByRole("button", { name: "Login" })).toBeVisible();
  });
});
