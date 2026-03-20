import { defineConfig } from "@playwright/test";

const serverTarget = process.env.PW_SERVER_TARGET ?? "all";

const webServers = [
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
];

function resolveWebServers() {
  if (serverTarget === "admin") {
    return webServers.slice(0, 1);
  }

  if (serverTarget === "creator") {
    return webServers.slice(1);
  }

  return webServers;
}

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
    locale: "zh-CN",
  },
  webServer: resolveWebServers(),
});
