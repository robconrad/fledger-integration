---
module: Integration
date: 2026-02-25
problem_type: test_failure
component: testing_framework
symptoms:
  - "UI test passes locally but fails in CI after page.reload() — deleted row still visible"
  - "InlineEdit dblclick makes row locator stale — hasText locator cannot find text inside input value"
  - "waitForRequest completes before server processes mutation, causing race with subsequent reload"
root_cause: async_timing
resolution_type: code_fix
severity: high
tags: [playwright, race-condition, stale-locator, wait-for-response, inline-edit, dblclick]
---

# Troubleshooting: Playwright Stale Locators and Mutation Race Conditions in UI CRUD Tests

## Problem
Playwright UI tests for inline-edit CRUD operations failed intermittently in CI due to two compounding issues: (1) `waitForRequest` completing before the server finished processing the mutation, causing `page.reload()` to show stale data, and (2) `dblclick` on a table row triggering InlineEdit mode which replaces row text content with input elements, making `hasText` locators stale.

## Environment
- Module: fledger-integration (cross-repo Playwright test suite)
- Stack: TypeScript, Playwright, React 19 (fledger-web), MUI, Vite
- Affected Component: `ui-accounts-crud.spec.ts`, `ui-items-crud.spec.ts`, `tests/support/browser.ts`
- Date: 2026-02-25

## Symptoms
- After clicking delete icon and calling `page.reload()`, the deleted row was still visible in CI (passed locally)
- After `dblclick` on a table cell, `page.locator("tbody tr", { hasText: "account-name" })` could no longer find the row — the name text had moved from DOM textContent into an `<input>` element's `.value`
- MUI DatePicker rendered section-based input incompatible with Playwright's `.fill()` method — no standard `input[type='date']` exists

## What Didn't Work

**Attempted Solution 1:** `waitForRequest` — wait for the GraphQL request to be sent before reloading
- **Why it failed:** `waitForRequest` resolves when the browser *sends* the request, not when the server *responds*. The subsequent `page.reload()` fires before the mutation is committed to the database, so the page loads stale data.

**Attempted Solution 2:** Locating the edit-mode input via the original `row` locator (e.g., `row.locator("input[placeholder='Name']")`)
- **Why it failed:** The `row` locator was created with `{ hasText: "account-name" }`. After dblclick triggers InlineEdit, the component replaces the cell's text content with an `<input>` whose `.value` contains the text. Since `hasText` matches against `textContent` (not input values), the locator becomes stale and times out.

**Attempted Solution 3:** Using `input[type='date']` to fill the date field in the create-item form
- **Why it failed:** MUI's `DatePicker` renders a custom section-based input (month/day/year sections), not a native date input. Playwright's `.fill()` doesn't work with this component.

## Solution

### Fix 1: `waitForResponse` instead of `waitForRequest`

```typescript
// Before (broken — race condition):
export async function waitForOperationRequest(
  page: Page, operationName: string
): Promise<void> {
  await page.waitForRequest((req) => {
    if (!req.url().includes("/graphql")) return false;
    const body = req.postData() || "";
    return body.includes(`"operationName":"${operationName}"`);
  });
}

// After (fixed — waits for server response):
export async function waitForOperationResponse(
  page: Page, operationName: string, timeout = 15_000
): Promise<void> {
  const response = await page.waitForResponse(
    (resp) => {
      const req = resp.request();
      if (!req.url().includes("/graphql") || req.method() !== "POST") return false;
      const body = req.postData() || "";
      return body.includes(`"operationName":"${operationName}"`);
    },
    { timeout }
  );
  expect(response.status()).toBe(200);
}
```

### Fix 2: Locate edit-mode inputs via `tbody` scope, not stale row locator

```typescript
// Before (broken — stale locator after dblclick):
const row = page.locator("tbody tr", { hasText: accountName });
await row.locator("td", { hasText: accountName }).first().dblclick();
const nameInput = row.locator("input[placeholder='Name']"); // STALE — row can't be found

// After (fixed — scope to tbody, then walk up to tr):
await row.locator("td", { hasText: accountName }).first().dblclick();
const nameInput = page.locator("tbody input[placeholder='Name']");
await expect(nameInput).toBeVisible({ timeout: 5_000 });
await nameInput.clear();
await nameInput.fill(updatedName);
const editRow = nameInput.locator("xpath=ancestor::tr");
await editRow.getByRole("button", { name: /update/i }).click();
```

### Fix 3: Create items via API to bypass MUI DatePicker

```typescript
// Instead of automating the create form (MUI DatePicker not fillable):
const item = await createItem(request, token, {
  account_id: acc.id,
  category_id: cat.id,
  amount: 4250,
  date: today,
  comments,
});

// Then test read/update/delete via the UI
```

## Why This Works

1. **Race condition root cause:** `page.waitForRequest()` resolves at the network layer when the browser sends the HTTP request. The server hasn't processed the mutation yet. If you call `page.reload()` immediately after, the GET request for page data may hit the database before the mutation is committed. `page.waitForResponse()` resolves only after the server sends back the full response, guaranteeing the mutation is complete.

2. **Stale locator root cause:** Playwright's `hasText` matcher checks DOM `textContent`, not input `value` attributes. When fledger-web's `InlineEdit` component activates on dblclick, it replaces the cell's text node with an `<input>` element. The text moves from `textContent` to `input.value`, so `hasText: "account-name"` no longer matches that row. Scoping to `tbody` and using `xpath=ancestor::tr` avoids depending on text that may move between DOM text and input values.

3. **MUI DatePicker:** MUI's DatePicker renders a proprietary section-based input (not `<input type="date">`). Each date segment (MM/DD/YYYY) is a separate editable section. Playwright's `.fill()` targets the underlying input but MUI intercepts and rejects direct value setting. Creating items via API is the pragmatic solution — the test still covers read/update/delete through the UI.

## Prevention

- **Always use `waitForResponse`** (not `waitForRequest`) when you need to ensure a mutation is complete before taking subsequent actions like `page.reload()` or navigating away
- **After dblclick on editable table cells**, don't rely on the original row locator — the DOM structure changes. Scope to the table body and use `xpath=ancestor::tr` to find the containing row from a known input
- **For complex UI components** (date pickers, rich text editors, custom selects), consider creating test data via API and testing only the CRUD operations the UI can reliably handle
- **Test in CI early** — race conditions often only surface under CI load where timing differs from local development

## Related Issues

- See also: [persistent-context-closure-ext-auth-Integration-20260225.md](./persistent-context-closure-ext-auth-Integration-20260225.md) — Persistent browser context dies between Chrome extension test boundaries, requiring combined tests
