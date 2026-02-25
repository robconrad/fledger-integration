import { expect, type Page, type Locator, type Request, type APIRequestContext } from "@playwright/test";
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
  await page.evaluate((t) => {
    window.localStorage.setItem("fledgerAuthToken", t);
    // Set expiry far in the future
    window.localStorage.setItem(
      "fledgerAuthTokenExpiresAt",
      String(Date.now() + 3600_000)
    );
  }, token);
  await page.reload();
}

export function waitForOperationRequest(
  page: Page,
  operationName: string,
  timeout = 10_000
): Promise<Request> {
  return page.waitForRequest(
    (request) => {
      if (!request.url().includes("/graphql") || request.method() !== "POST") {
        return false;
      }
      const body = request.postData() || "";
      return body.includes(`"operationName":"${operationName}"`);
    },
    { timeout }
  );
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
  const deleteRequest = waitForOperationRequest(page, operationName, 12_000);
  await deleteIcon.click({ force: true });

  const closeButton = page
    .locator(".Toastify__toast .Toastify__close-button")
    .last();
  await closeButton
    .waitFor({ state: "visible", timeout: 2000 })
    .then(() => closeButton.click({ force: true }))
    .catch(() => undefined);

  await deleteRequest;
}
