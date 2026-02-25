import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { isExtensionAvailable, launchExtensionContext } from "./support/extension.js";

test.skip(!isExtensionAvailable(), "Extension not built — run: cd ../fledger-chrome && npm run build");

test.describe("Chrome Extension: Authentication", () => {
  let context: BrowserContext;
  let extensionId: string;
  let optionsPage: Page;

  test.beforeAll(async () => {
    const ext = await launchExtensionContext();
    context = ext.context;
    extensionId = ext.extensionId;
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test("extension options page loads", async () => {
    optionsPage = await context.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/src/options.html`);
    await optionsPage.waitForLoadState("domcontentloaded");

    // Verify the page rendered
    await expect(optionsPage.locator("h1")).toContainText("Fledger Importer");

    // Verify endpoint selector has dev option
    const select = optionsPage.locator("select[name='graphqlEndpoint']");
    await expect(select).toBeVisible();
  });

  test("login via extension options page", async () => {
    // The options page should already be open from the previous test
    if (!optionsPage || optionsPage.isClosed()) {
      optionsPage = await context.newPage();
      await optionsPage.goto(`chrome-extension://${extensionId}/src/options.html`);
      await optionsPage.waitForLoadState("domcontentloaded");
    }

    // Fill auth credentials — the AuthSection has username and password inputs
    const usernameInput = optionsPage.locator("input").nth(0);
    const passwordInput = optionsPage.locator("input[type='password']");
    await usernameInput.fill("fledger");
    await passwordInput.fill("fledger-local");

    // Click Login
    await optionsPage.getByRole("button", { name: "Login" }).click();

    // Wait for status to show logged in
    await expect(optionsPage.locator("#status")).toContainText("Logged in", { timeout: 10_000 });

    // Logout button should now be visible
    await expect(optionsPage.getByRole("button", { name: "Logout" })).toBeVisible();
  });

  test("logout via extension options page", async () => {
    if (!optionsPage || optionsPage.isClosed()) {
      throw new Error("Options page not available — login test must run first");
    }

    await optionsPage.getByRole("button", { name: "Logout" }).click();
    await expect(optionsPage.locator("#status")).toContainText("Logged out", { timeout: 10_000 });

    // Login button should reappear
    await expect(optionsPage.getByRole("button", { name: "Login" })).toBeVisible();
  });
});
