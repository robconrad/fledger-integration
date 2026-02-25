import { expect, type Page, type Locator, type APIRequestContext } from "@playwright/test";
import { getAuthToken, WEB_URL } from "./api.js";

export async function loginViaUI(page: Page): Promise<void> {
  await page.goto(`${WEB_URL}/login`);
  await page.locator("#username").fill("fledger");
  await page.locator("#password").fill("fledger-local");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByRole("link", { name: "Logout" })).toBeVisible();
}

export async function loginViaAPI(
  page: Page,
  request: APIRequestContext
): Promise<void> {
  const token = await getAuthToken(request);
  await page.goto(WEB_URL);
  // Keys must match fledger-web's auth storage convention
  await page.evaluate((t) => {
    window.localStorage.setItem("fledgerAuthToken", t);
    window.localStorage.setItem(
      "fledgerAuthTokenExpiresAt",
      String(Date.now() + 3600_000)
    );
  }, token);
  await page.reload();
}

export async function waitForOperationResponse(
  page: Page,
  operationName: string,
  timeout = 15_000
): Promise<void> {
  const response = await page.waitForResponse(
    (resp) => {
      const req = resp.request();
      if (!req.url().includes("/graphql") || req.method() !== "POST") {
        return false;
      }
      const body = req.postData() || "";
      return body.includes(`"operationName":"${operationName}"`);
    },
    { timeout }
  );
  expect(response.status()).toBe(200);
}

export async function selectRowOptionByTyping(
  page: Page,
  row: Locator,
  index: number,
  optionText: string
): Promise<void> {
  const select = row.locator(".MenuInputContainer").nth(index);
  await select.locator(".MenuInput__control").click();
  const input = select.locator("input");
  await input.fill(optionText);
  await page
    .locator(".MenuInput__menu")
    .locator(".MenuInput__option", { hasText: optionText })
    .first()
    .click();
  await expect(select).toContainText(optionText);
}

export async function triggerDeleteAndWait(
  page: Page,
  row: Locator,
  operationName: string
): Promise<void> {
  const deleteIcon = row.getByAltText("delete");
  const deleteDone = waitForOperationResponse(page, operationName);
  await deleteIcon.click({ force: true });

  const closeButton = page
    .locator(".Toastify__toast .Toastify__close-button")
    .last();
  // Toast may not always appear; safe to ignore if absent
  await closeButton
    .waitFor({ state: "visible", timeout: 2000 })
    .then(() => closeButton.click({ force: true }))
    .catch(() => undefined);

  await deleteDone;
}
