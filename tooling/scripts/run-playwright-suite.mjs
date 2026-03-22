import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { defaultDatabaseUrl } from "./run-dev-real.mjs";

export function resolveSetupCommands(target) {
  if (target === "admin-real" || target === "creator-real" || target === "all-real") {
    return ["corepack pnpm run db:bootstrap-dev"];
  }
  return [];
}

export function buildPlaywrightCommand(args) {
  return process.platform === "win32"
    ? `corepack pnpm exec playwright ${args.join(" ")}`
    : `corepack pnpm exec playwright ${args.map((value) => `'${value.replaceAll("'", "'\\''")}'`).join(" ")}`;
}

export function buildRunEnv(target, baseEnv = process.env, extraEnv = {}) {
  const env = {
    ...baseEnv,
    ...extraEnv,
  };

  if (target === "admin-real" || target === "creator-real" || target === "all-real") {
    return {
      ...env,
      DB_DRIVER: "postgres",
      DATABASE_URL: defaultDatabaseUrl,
    };
  }

  return env;
}

function runShellCommand(command, env) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      stdio: "inherit",
      shell: true,
      env,
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      resolve(code ?? 1);
    });
  });
}

export async function main(argv = process.argv.slice(2)) {
  const [target, ...args] = argv;

  if (!target) {
    console.error("Usage: node tooling/scripts/run-playwright-suite.mjs <admin|creator|all|admin-real|creator-real|all-real> [playwright args...]");
    return 1;
  }

  const runEnv = buildRunEnv(target, process.env, {
    PW_SERVER_TARGET: target,
  });

  for (const setupCommand of resolveSetupCommands(target)) {
    const setupExitCode = await runShellCommand(setupCommand, runEnv);
    if (setupExitCode !== 0) {
      return setupExitCode;
    }
  }

  return runShellCommand(buildPlaywrightCommand(args), runEnv);
}

const isEntrypoint =
  Boolean(process.argv[1]) &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isEntrypoint) {
  const exitCode = await main();
  process.exit(exitCode);
}
