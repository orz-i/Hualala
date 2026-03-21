import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  buildManagedEnv,
  buildPostgresReadyCommand,
  buildSpawnDescriptor,
  defaultDatabaseUrl,
  fetchWithTimeout,
  stopTrackedChild,
} from "./run-dev-real.mjs";

test("buildManagedEnv forces postgres defaults for one-command real dev", () => {
  const env = buildManagedEnv({
    PATH: "C:\\Windows\\System32",
    DB_DRIVER: "memory",
    DATABASE_URL: "postgres://wrong:wrong@127.0.0.1:5544/other",
  });

  assert.equal(env.PATH, "C:\\Windows\\System32");
  assert.equal(env.DB_DRIVER, "postgres");
  assert.equal(env.DATABASE_URL, defaultDatabaseUrl);
});

test("buildPostgresReadyCommand reuses docker compose pg_isready health probe", () => {
  assert.equal(
    buildPostgresReadyCommand(),
    "node tooling/scripts/docker_compose.mjs exec -T postgres pg_isready -U hualala -d hualala",
  );
});

test("buildSpawnDescriptor isolates shell execution for each platform", () => {
  assert.deepEqual(buildSpawnDescriptor("echo ok", "win32"), {
    file: "cmd.exe",
    args: ["/d", "/s", "/c", "echo ok"],
    detached: false,
  });

  assert.deepEqual(buildSpawnDescriptor("echo ok", "linux"), {
    file: "/bin/sh",
    args: ["-lc", "echo ok"],
    detached: true,
  });
});

test("fetchWithTimeout attaches an AbortSignal and aborts hanging requests", async () => {
  let receivedSignal = null;

  await assert.rejects(
    () =>
      fetchWithTimeout("http://127.0.0.1:65535/hang", {
        timeoutMs: 10,
        fetchFn: async (_url, init = {}) =>
          new Promise((_resolve, reject) => {
            receivedSignal = init.signal;
            init.signal?.addEventListener(
              "abort",
              () => {
                reject(new Error("aborted"));
              },
              { once: true },
            );
          }),
      }),
    /aborted/,
  );

  assert.ok(receivedSignal);
  assert.equal(receivedSignal.aborted, true);
});

test("stopTrackedChild waits for process exit instead of fixed delay", { timeout: 15_000 }, async () => {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"], {
    stdio: "ignore",
    detached: process.platform !== "win32",
  });
  const exitPromise = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      resolve({ code, signal });
    });
  });

  await stopTrackedChild(
    {
      child,
      exitPromise,
    },
    { name: "probe", graceMs: 1_000, killMs: 1_000 },
  );

  const result = await exitPromise;
  assert.ok(result.code !== null || result.signal !== null);
});
