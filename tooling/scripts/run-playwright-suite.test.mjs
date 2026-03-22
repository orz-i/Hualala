import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { join } from "node:path";

const scriptPath = join(process.cwd(), "tooling", "scripts", "run-playwright-suite.mjs");

function inspectModuleExpression(expression) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import(${JSON.stringify(scriptPath.replaceAll("\\", "/").replace(/^([A-Za-z]):/, "file:///$1:"))}).then((mod) => { process.stdout.write(JSON.stringify(${expression})); }).catch((error) => { console.error(error); process.exit(1); });`,
      ],
      {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `child exited with code ${code}`));
        return;
      }
      resolve(JSON.parse(stdout));
    });
  });
}

test("run-playwright-suite real targets prepend db bootstrap", async () => {
  const allRealSetup = await inspectModuleExpression("mod.resolveSetupCommands('all-real')");
  const adminRealSetup = await inspectModuleExpression("mod.resolveSetupCommands('admin-real')");
  const creatorSetup = await inspectModuleExpression("mod.resolveSetupCommands('creator')");

  assert.deepEqual(allRealSetup, ["corepack pnpm run db:bootstrap-dev"]);
  assert.deepEqual(adminRealSetup, ["corepack pnpm run db:bootstrap-dev"]);
  assert.deepEqual(creatorSetup, []);
});

test("run-playwright-suite exports playwright command builder", async () => {
  const command = await inspectModuleExpression(
    "mod.buildPlaywrightCommand(['test', 'tests/e2e/phase1-real-acceptance.spec.ts'])",
  );

  assert.match(command, /playwright/);
  assert.match(command, /phase1-real-acceptance\.spec\.ts/);
});

test("run-playwright-suite injects postgres env for real targets", async () => {
  const realEnv = await inspectModuleExpression(
    "mod.buildRunEnv('admin-real', { DATABASE_URL: 'postgres://wrong/wrong', DB_DRIVER: 'memory' }, { PW_SERVER_TARGET: 'admin-real' })",
  );
  const mockEnv = await inspectModuleExpression(
    "mod.buildRunEnv('admin', { DATABASE_URL: 'postgres://keep/me', DB_DRIVER: 'memory' }, { PW_SERVER_TARGET: 'admin' })",
  );

  assert.equal(realEnv.DB_DRIVER, "postgres");
  assert.match(realEnv.DATABASE_URL, /postgres:\/\/hualala:hualala@127\.0\.0\.1:5432\/hualala\?sslmode=disable/);
  assert.equal(realEnv.PW_SERVER_TARGET, "admin-real");
  assert.equal(mockEnv.DB_DRIVER, "memory");
  assert.equal(mockEnv.DATABASE_URL, "postgres://keep/me");
  assert.equal(mockEnv.PW_SERVER_TARGET, "admin");
});
