import { defineConfig } from "@playwright/test";

const serverTarget = process.env.PW_SERVER_TARGET ?? "all";

const backendServer = {
  command: "node tooling/scripts/run-backend-dev.mjs",
  url: "http://127.0.0.1:8080/healthz",
  reuseExistingServer: true,
  timeout: 120_000,
};

const frontendServers = [
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
    return frontendServers.slice(0, 1);
  }

  if (serverTarget === "creator") {
    return frontendServers.slice(1);
  }

  if (serverTarget === "admin-real") {
    return [backendServer, frontendServers[0]];
  }

  if (serverTarget === "creator-real") {
    return [backendServer, frontendServers[1]];
  }

  if (serverTarget === "all-real") {
    return [backendServer, ...frontendServers];
  }

  return frontendServers;
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
