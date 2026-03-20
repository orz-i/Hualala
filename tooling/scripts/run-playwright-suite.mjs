import { spawn } from "node:child_process";

const [target, ...args] = process.argv.slice(2);

if (!target) {
  console.error("Usage: node tooling/scripts/run-playwright-suite.mjs <admin|creator|all> [playwright args...]");
  process.exit(1);
}

const command =
  process.platform === "win32"
    ? `corepack pnpm exec playwright ${args.join(" ")}`
    : `corepack pnpm exec playwright ${args.map((value) => `'${value.replaceAll("'", "'\\''")}'`).join(" ")}`;

const child = spawn(command, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    PW_SERVER_TARGET: target,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
