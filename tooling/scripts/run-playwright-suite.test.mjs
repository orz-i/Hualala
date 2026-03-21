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
