import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { isExtensionAvailable, launchExtensionContext } from "./support/extension.js";

test.skip(!isExtensionAvailable(), "Extension not built — run: cd ../fledger-chrome && npm run build");

test.describe("Chrome Extension: Authentication", () => {
  let context: BrowserContext;
  let extensionId: string;
  let cleanup: () => void;

  test.beforeAll(async () => {
    const ext = await launchExtensionContext();
    context = ext.context;
    extensionId = ext.extensionId;
    cleanup = ext.cleanup;
  });

  test.afterAll(async () => {
    await context?.close();
    cleanup?.();
  });

  async function openOptionsPage(): Promise<Page> {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options.html`);
    await page.waitForLoadState("domcontentloaded");
    return page;
  }

  test("extension options page loads", async () => {
    const optionsPage = await openOptionsPage();

    // Verify the page rendered
    await expect(optionsPage.locator("h1")).toContainText("Fledger Importer");

    // Verify endpoint selector has dev option
    const select = optionsPage.locator("select[name='graphqlEndpoint']");
    await expect(select).toBeVisible();

    await optionsPage.close();
  });

  test("login via extension options page", async () => {
    const optionsPage = await openOptionsPage();

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

    await optionsPage.close();
  });

  test("logout via extension options page", async () => {
    // Login first so we can test logout
    const optionsPage = await openOptionsPage();
    const usernameInput = optionsPage.locator("input").nth(0);
    const passwordInput = optionsPage.locator("input[type='password']");
    await usernameInput.fill("fledger");
    await passwordInput.fill("fledger-local");
    await optionsPage.getByRole("button", { name: "Login" }).click();
    await expect(optionsPage.locator("#status")).toContainText("Logged in", { timeout: 10_000 });

    await optionsPage.getByRole("button", { name: "Logout" }).click();
    await expect(optionsPage.locator("#status")).toContainText("Logged out", { timeout: 10_000 });

    // Login button should reappear
    await expect(optionsPage.getByRole("button", { name: "Login" })).toBeVisible();

    await optionsPage.close();
  });
});
