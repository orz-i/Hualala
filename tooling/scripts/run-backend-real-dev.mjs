import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");

const managedChildren = [];
let shuttingDown = false;

function spawnManaged(name, command) {
  const child = spawn(command, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  managedChildren.push({ name, child });

  child.on("exit", async (code, signal) => {
    if (shuttingDown) {
      return;
    }
    await shutdown(code ?? 1, signal);
  });

  child.on("error", async () => {
    if (shuttingDown) {
      return;
    }
    await shutdown(1);
  });
}

async function shutdown(code = 0, signal = null) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  for (const handle of managedChildren) {
    if (!handle.child || handle.child.exitCode !== null || handle.child.killed) {
      continue;
    }
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(handle.child.pid), "/t", "/f"], {
        stdio: "ignore",
        shell: false,
      });
      continue;
    }
    handle.child.kill("SIGTERM");
  }

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code);
}

process.on("SIGINT", () => {
  void shutdown(0);
});

process.on("SIGTERM", () => {
  void shutdown(0);
});

spawnManaged("backend", "node tooling/scripts/run-backend-dev.mjs");
spawnManaged("backend-worker", "node tooling/scripts/run-backend-worker-dev.mjs");

await new Promise(() => {});
