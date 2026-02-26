---
module: Integration
date: 2026-02-26
problem_type: test_failure
component: testing_framework
symptoms:
  - "Extension tests fail with 'Failed to fetch' when API runs on dynamic ports"
  - "'beforeAll' hook timeout of 60000ms exceeded when using sw.evaluate()"
  - "Chrome extension defaults graphqlEndpoint to localhost:8080 regardless of API_PORT"
root_cause: config_error
resolution_type: code_fix
severity: high
tags: [chrome-extension, dynamic-ports, service-worker, chrome-storage, playwright]
---

# Troubleshooting: Chrome Extension Tests Fail on Dynamic Ports

## Problem
When CI allocates unique per-run ports (API on 28000+ range instead of 8080), all chrome extension integration tests fail because the extension's default graphql endpoint (`http://localhost:8080/graphql`) doesn't match the actual API port. Additionally, the first attempt to fix this via `sw.evaluate()` on the service worker caused all `beforeAll` hooks to time out.

## Environment
- Module: Integration (fledger-integration)
- Affected Component: Extension test support (`tests/support/extension.ts`) and chrome extension storage
- Date: 2026-02-26

## Symptoms
- 3 extension tests fail: ext-auth, ext-import, ext-popup-ui
- Error: `expect(locator).toContainText("Logged in")` receives `"Failed to fetch"` instead
- 73 non-extension tests pass (they use `API_URL` from `tests/support/api.ts` which reads `process.env.API_PORT`)
- The extension has its own settings in `chrome.storage.sync` with key `fledgerImporterSettings` containing `graphqlEndpoint`, defaulting to `http://localhost:8080/graphql`

## What Didn't Work

**Attempted Solution 1:** Using `sw.evaluate()` to set `chrome.storage.sync` via the service worker
- **Why it failed:** `sw.evaluate(async (endpoint) => { await chrome.storage.sync.set(...) }, graphqlEndpoint)` caused all `beforeAll` hooks to time out at 60 seconds. Playwright's `Worker.evaluate()` with async functions on service workers appears to hang indefinitely — the promise never resolves. This is likely a Playwright limitation with async evaluation in service worker contexts.

## Solution

Use a page in the extension's origin to access `chrome.storage.sync` instead of the service worker.

**Code changes:**

```typescript
// Before (broken — sw.evaluate hangs):
const graphqlEndpoint = `${API_URL}/graphql`;
await sw.evaluate(async (endpoint) => {
  const stored = await chrome.storage.sync.get("fledgerImporterSettings");
  const settings = (stored["fledgerImporterSettings"] as Record<string, unknown>) || {};
  settings.graphqlEndpoint = endpoint;
  await chrome.storage.sync.set({ fledgerImporterSettings: settings });
}, graphqlEndpoint);

// After (fixed — use extension page for chrome.storage access):
const graphqlEndpoint = `${API_URL}/graphql`;
const setupPage = await context.newPage();
await setupPage.goto(`chrome-extension://${extensionId}/src/options.html`);
await setupPage.waitForLoadState("domcontentloaded");
await setupPage.evaluate(async (endpoint) => {
  const stored = await chrome.storage.sync.get("fledgerImporterSettings");
  const settings = (stored["fledgerImporterSettings"] as Record<string, unknown>) || {};
  settings.graphqlEndpoint = endpoint;
  await chrome.storage.sync.set({ fledgerImporterSettings: settings });
}, graphqlEndpoint);
await setupPage.close();
```

This runs in `launchExtensionContext()` in `tests/support/extension.ts`, so all extension tests automatically get the correct API URL before any test logic runs.

## Why This Works

1. **Root cause:** The chrome extension stores its API endpoint in `chrome.storage.sync` under `fledgerImporterSettings.graphqlEndpoint`, defaulting to `http://localhost:8080/graphql`. When CI uses dynamic ports, this default is wrong and all API calls from the extension fail with "Failed to fetch".

2. **Why sw.evaluate fails:** Playwright's `Worker.evaluate()` doesn't reliably resolve async promises in service worker contexts. The `chrome.storage.sync` API is async (returns Promises), so the evaluate callback never completes from Playwright's perspective.

3. **Why page.evaluate works:** A regular page in the extension's origin (`chrome-extension://<id>/...`) has full access to `chrome.storage.sync` and Playwright's `Page.evaluate()` correctly handles async functions. Opening the options page, setting storage, and closing it takes milliseconds and is fully reliable.

4. **No race with onInstalled:** The extension's `chrome.runtime.onInstalled` handler only sets default settings if none exist (`if (!existing[SETTINGS_KEY])`). Since the service worker registers before our code runs, `onInstalled` has already set defaults. Our override comes after and wins.

## Prevention

- When introducing dynamic ports to CI, audit ALL consumers of hardcoded port references — not just test files and configs, but also extension storage defaults and any other runtime configuration
- Never use `sw.evaluate()` with async functions in Playwright extension tests — use a page in the extension origin instead
- Consider adding a helper to `launchExtensionContext()` that accepts a config override object for any settings that might vary by environment

## Related Issues

No related issues documented yet.
