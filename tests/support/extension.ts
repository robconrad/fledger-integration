import { chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

// Playwright transpiles TS to CJS, so __dirname is available at runtime.
// Path: tests/support/ → ../../ → fledger-integration/ → ../ → fledger/
const EXTENSION_DIST_PATH = path.resolve(
  __dirname,
  "../../../fledger-chrome/dist"
);

export function isExtensionAvailable(): boolean {
  return fs.existsSync(path.join(EXTENSION_DIST_PATH, "manifest.json"));
}

export async function launchExtensionContext(): Promise<{
  context: BrowserContext;
  extensionId: string;
}> {
  if (!isExtensionAvailable()) {
    throw new Error(
      `Extension not built. Run "cd ../fledger-chrome && npm run build" first.\n` +
        `Expected: ${EXTENSION_DIST_PATH}/manifest.json`
    );
  }

  const userDataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "fledger-ext-test-")
  );

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_DIST_PATH}`,
      `--load-extension=${EXTENSION_DIST_PATH}`,
      "--no-first-run",
      "--disable-default-apps",
    ],
  });

  // Wait for the extension's service worker to register
  const sw =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker", { timeout: 10_000 }));
  const extensionId = sw.url().split("/")[2]!;

  return { context, extensionId };
}

export const EXTENSION_MESSAGE_TYPES = {
  IMPORT_TRANSACTIONS: "FLEDGER_IMPORT_TRANSACTIONS",
  IMPORT_PROVISIONAL_TRANSACTIONS: "FLEDGER_IMPORT_PROVISIONAL_TRANSACTIONS",
  PREPARE_TRANSACTIONS: "FLEDGER_PREPARE_TRANSACTIONS",
  IMPORTER_BOOTSTRAP: "FLEDGER_IMPORTER_BOOTSTRAP",
  LOOKUP_SYNCED_ITEMS: "FLEDGER_LOOKUP_SYNCED_ITEMS",
  LIST_ACCOUNTS: "FLEDGER_LIST_ACCOUNTS",
  GET_ACCOUNT_MAPPING: "FLEDGER_GET_ACCOUNT_MAPPING",
  SAVE_ACCOUNT_MAPPING: "FLEDGER_SAVE_ACCOUNT_MAPPING",
  AUTH_STATUS: "FLEDGER_AUTH_STATUS",
  AUTH_LOGIN: "FLEDGER_AUTH_LOGIN",
  AUTH_LOGOUT: "FLEDGER_AUTH_LOGOUT",
} as const;
