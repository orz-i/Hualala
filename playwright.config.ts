import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: true,
  },
  webServer: [
    {
      command:
        "corepack pnpm --filter @hualala/admin exec vite --host 127.0.0.1 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command:
        "corepack pnpm --filter @hualala/creator exec vite --host 127.0.0.1 --port 4174 --strictPort",
      url: "http://127.0.0.1:4174",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
