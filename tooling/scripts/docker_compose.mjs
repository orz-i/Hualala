import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");

function resolveDockerCommand() {
  const canExecute = (command) => {
    const probe = spawnSync(command, ["--version"], { stdio: "ignore", shell: false });
    return probe.status === 0;
  };

  if (process.platform === "win32") {
    const windowsCandidates = [
      "docker",
      "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
    ];
    for (const candidate of windowsCandidates) {
      if ((candidate === "docker" && canExecute(candidate)) || (candidate !== "docker" && existsSync(candidate) && canExecute(candidate))) {
        return candidate;
      }
    }
  }
  return "docker";
}

async function run() {
  const dockerCommand = resolveDockerCommand();
  const child = spawn(
    dockerCommand,
    ["compose", "-f", "infra/docker/postgres.compose.yml", ...process.argv.slice(2)],
    {
      cwd: repoRoot,
      stdio: "inherit",
      shell: false,
    },
  );

  const exitCode = await new Promise((resolveExit, rejectExit) => {
    child.on("error", rejectExit);
    child.on("close", resolveExit);
  });

  process.exit(exitCode ?? 1);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
