---
module: Integration
date: 2026-02-25
problem_type: test_failure
component: testing_framework
symptoms:
  - "Error: locator.fill: Target page, context or browser has been closed"
  - "ext-auth logout test fails consistently in CI despite passing login test"
  - "Persistent browser context dies between Playwright test boundaries"
root_cause: async_timing
resolution_type: test_fix
severity: high
tags: [playwright, persistent-context, chrome-extension, browser-closed, headed-mode]
---

# Troubleshooting: Playwright Persistent Context Closes Between Chrome Extension Tests

## Problem
Chrome extension authentication tests using `chromium.launchPersistentContext` failed consistently in CI. The login test passed, but the subsequent logout test immediately failed with "Target page, context or browser has been closed" when attempting to interact with page elements — even when using a shared page created in `beforeAll`.

## Environment
- Module: fledger-integration (cross-repo Playwright test suite)
- Stack: TypeScript, Playwright, Chrome Extension (Manifest V3), headed Chromium
- Affected Component: `tests/ext-auth.spec.ts`
- CI Runner: self-hosted macOS
- Date: 2026-02-25

## Symptoms
- `Error: locator.fill: Target page, context or browser has been closed` at the start of the 3rd test (logout)
- First two tests (page loads, login) passed successfully
- The shared `optionsPage` created in `beforeAll` became invalid between test 2 and test 3
- Only occurred in CI (headed mode, macOS self-hosted runner), not always reproducible locally

## What Didn't Work

**Attempted Solution 1:** Keep a background `about:blank` page alive to prevent context auto-closure
- **Why it failed:** Created a background page in `beforeAll` with `await context.newPage(); await page.goto("about:blank")`. The persistent context still died between tests. On macOS, persistent contexts shouldn't auto-close when pages remain open (that's a Linux-specific behavior per Playwright issue #29726), so the problem wasn't about zero-page auto-closure.

**Attempted Solution 2:** Reuse a single shared page with `navigateToOptions()` instead of creating/closing pages per test
- **Why it failed:** Created `optionsPage` once in `beforeAll`, navigated via `goto()` in each test. The login test succeeded, but by the time the logout test ran, the page/context was already dead. The shared page approach prevented the zero-pages issue but didn't prevent whatever was killing the context between test boundaries.

**Attempted Solution 3:** Add `waitForLoadState("networkidle")` before interacting with the page in the logout test
- **Why it failed:** The context was already closed before any page interaction could occur — `networkidle` can't fix a dead context.

## Solution

Combined the login and logout operations into a single test, eliminating the cross-test state dependency entirely:

```typescript
// Before (broken — 2 separate tests):
test("login via extension options page", async () => {
  await navigateToOptions();
  // ... fill credentials, click Login ...
  await expect(optionsPage.locator("#status")).toContainText("Logged in", { timeout: 30_000 });
  await expect(optionsPage.getByRole("button", { name: "Logout" })).toBeVisible();
});

test("logout via extension options page", async () => {
  // Login first so we can test logout
  await navigateToOptions();
  // ... fill credentials, click Login ...  <-- FAILS HERE: context already closed
  await optionsPage.getByRole("button", { name: "Logout" }).click();
  await expect(optionsPage.locator("#status")).toContainText("Logged out");
});

// After (fixed — single combined test):
test("login and logout via extension options page", async () => {
  await navigateToOptions();
  // ... fill credentials, click Login ...
  await expect(optionsPage.locator("#status")).toContainText("Logged in", { timeout: 30_000 });
  await expect(optionsPage.getByRole("button", { name: "Logout" })).toBeVisible();

  // Now test logout in the same test
  await optionsPage.getByRole("button", { name: "Logout" }).click();
  await expect(optionsPage.locator("#status")).toContainText("Logged out", { timeout: 10_000 });
  await expect(optionsPage.getByRole("button", { name: "Login" })).toBeVisible();
});
```

## Why This Works

1. **Root cause:** Playwright persistent browser contexts used for Chrome extension testing (required: `headless: false`, `launchPersistentContext` with `--load-extension` args) have fragile lifecycle management between test boundaries. The exact mechanism appears to be an interaction between Chrome's extension service worker lifecycle, the headed browser mode, and Playwright's test runner infrastructure. Between tests, Playwright performs teardown/setup that can race with Chrome's internal state management for the persistent context.

2. **Why combining works:** By keeping the entire login-then-logout flow in a single test, there's no test boundary where the context can die. The page remains continuously active with no gaps.

3. **Contrast with ext-import tests:** The `ext-import.spec.ts` file also uses a persistent context and shared page across 4 tests — but those tests only call `optionsPage.evaluate()` to send Chrome runtime messages. They don't navigate the page or interact with DOM elements between tests. The key difference is that ext-auth tests perform full page navigation and UI interaction, which may trigger Chrome behaviors (page lifecycle events, service worker messages) that destabilize the persistent context.

## Prevention

- **For Chrome extension tests with persistent contexts:** Combine tightly-coupled UI interactions (login/logout, create/delete) into single tests rather than splitting across test boundaries
- **Prefer message-based testing over UI interaction** for extension functionality — `optionsPage.evaluate(() => chrome.runtime.sendMessage(...))` is more stable than navigating and filling forms across multiple tests
- **Keep extension tests minimal:** The `extension` project in `playwright.config.ts` already has `retries: 0` because persistent context teardown in `afterAll` makes retries fail. Fewer, more self-contained tests are more reliable than many interdependent ones
- **If you must split tests:** Ensure each test is fully self-contained — don't depend on state from a previous test, and consider creating a fresh page within the test rather than reusing a shared one

## Related Issues

- See also: [playwright-stale-locator-race-condition-Integration-20260225.md](./playwright-stale-locator-race-condition-Integration-20260225.md) — Different Playwright timing issue (stale locators after dblclick and mutation race conditions), but same theme of Playwright CI timing sensitivity
