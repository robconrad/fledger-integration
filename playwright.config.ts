import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${process.env.WEB_PORT || "23200"}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "api",
      testMatch: /(?:^|[/\\])(?!ui-|ext-)[^/\\]*\.spec\.ts$/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
      testMatch: /(?:^|[/\\])ui-.*\.spec\.ts$/,
    },
    {
      name: "extension",
      testMatch: /(?:^|[/\\])ext-.*\.spec\.ts$/,
      retries: 0,
    },
  ],
});
