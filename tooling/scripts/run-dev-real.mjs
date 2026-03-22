import { spawn, spawnSync } from "node:child_process";
import { createConnection } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");

const backendHealthUrl = "http://127.0.0.1:8080/healthz";
const adminUrl = "http://127.0.0.1:4173";
const creatorUrl = "http://127.0.0.1:4174";
export const defaultDatabaseUrl = "postgres://hualala:hualala@127.0.0.1:5432/hualala?sslmode=disable";

const requiredDevPorts = [
  { name: "backend", host: "127.0.0.1", port: 8080 },
  { name: "admin", host: "127.0.0.1", port: 4173 },
  { name: "creator", host: "127.0.0.1", port: 4174 },
];

const managedChildren = [];
let shuttingDown = false;
let activeCommandHandle = null;

function parseDatabaseAddress(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl || defaultDatabaseUrl);
    return {
      host: parsed.hostname || "127.0.0.1",
      port: Number(parsed.port || 5432),
    };
  } catch {
    return {
      host: "127.0.0.1",
      port: 5432,
    };
  }
}

function createExitPromise(child) {
  if (!child) {
    return Promise.resolve({ code: null, signal: null });
  }

  if (child.exitCode !== null) {
    return Promise.resolve({
      code: child.exitCode,
      signal: child.signalCode ?? null,
    });
  }

  return new Promise((resolveExit, rejectExit) => {
    let settled = false;
    const cleanup = () => {
      child.off("error", onError);
      child.off("close", onClose);
    };
    const onError = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      rejectExit(error);
    };
    const onClose = (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolveExit({ code, signal });
    };

    child.on("error", onError);
    child.on("close", onClose);
  });
}

function terminateTrackedChild(handle, force = false) {
  const child = handle?.child;
  if (!child || child.exitCode !== null || child.killed) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      shell: false,
    });
    return;
  }

  try {
    process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM");
  } catch {
    child.kill(force ? "SIGKILL" : "SIGTERM");
  }
}

export function buildManagedEnv(baseEnv = process.env, overrides = {}) {
  return {
    ...baseEnv,
    ...overrides,
    DB_DRIVER: "postgres",
    DATABASE_URL: defaultDatabaseUrl,
  };
}

export function buildPostgresReadyCommand() {
  return "node tooling/scripts/docker_compose.mjs exec -T postgres pg_isready -U hualala -d hualala";
}

export function buildSpawnDescriptor(command, platform = process.platform) {
  if (platform === "win32") {
    return {
      file: "cmd.exe",
      args: ["/d", "/s", "/c", command],
      detached: false,
    };
  }

  return {
    file: "/bin/sh",
    args: ["-lc", command],
    detached: true,
  };
}

function spawnCommand(command, options = {}) {
  const descriptor = buildSpawnDescriptor(command);
  const child = spawn(descriptor.file, descriptor.args, {
    cwd: repoRoot,
    stdio: options.stdio ?? "inherit",
    shell: false,
    detached: descriptor.detached,
    env: buildManagedEnv(process.env, options.env ?? {}),
  });

  return {
    command,
    child,
    exitPromise: createExitPromise(child),
  };
}

async function runCommand(command, options = {}) {
  const handle = spawnCommand(command, options);
  const { child } = handle;
  let stdout = "";
  let stderr = "";
  activeCommandHandle = handle;

  if (child.stdout) {
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
  }
  if (child.stderr) {
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
  }

  try {
    const { code: exitCode } = await handle.exitPromise;

    return {
      exitCode,
      stdout,
      stderr,
    };
  } finally {
    if (activeCommandHandle === handle) {
      activeCommandHandle = null;
    }
  }
}

async function runStep(label, command) {
  console.log(`[dev:real] ${label}: ${command}`);
  const { exitCode } = await runCommand(command);

  if (exitCode !== 0) {
    throw new Error(`[dev:real] ${label} failed with exit code ${exitCode ?? 1}`);
  }
}

async function waitForCommandSuccess(label, command, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";

  while (Date.now() < deadline) {
    const { exitCode, stdout, stderr } = await runCommand(command, { stdio: "pipe" });
    if (exitCode === 0) {
      return;
    }

    lastError = stderr.trim() || stdout.trim() || `exit code ${exitCode ?? 1}`;
    await delay(1_000);
  }

  throw new Error(`[dev:real] ${label} timed out after ${timeoutMs}ms: ${lastError}`);
}

export async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 2_000;
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetchFn(url, {
      ...(options.init ?? {}),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildOccupantLabel(occupant) {
  if (!occupant?.pid && !occupant?.command) {
    return "未能获取进程详情";
  }

  if (occupant?.pid && occupant?.command) {
    return `PID ${occupant.pid}, ${occupant.command}`;
  }
  if (occupant?.pid) {
    return `PID ${occupant.pid}`;
  }
  return occupant.command;
}

export function parseLsofMachineReadableOutput(stdout) {
  const trimmed = stdout?.trim();
  if (!trimmed) {
    return null;
  }

  const pidMatch = trimmed.match(/^p(\d+)/m);
  if (!pidMatch) {
    return null;
  }

  const parsedPid = Number(pidMatch[1]);
  const commandMatch = trimmed.match(/^c(.+)/m);
  const parsedCommand = commandMatch?.[1]?.trim();
  return {
    pid: Number.isFinite(parsedPid) ? parsedPid : null,
    command: parsedCommand || null,
  };
}

async function probePort(host, port, timeoutMs = 500) {
  return new Promise((resolveProbe) => {
    let settled = false;
    const socket = createConnection({ host, port });

    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolveProbe(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      finish(true);
    });
    socket.once("timeout", () => {
      finish(true);
    });
    socket.once("error", (error) => {
      const code = error?.code;
      if (code === "ECONNREFUSED" || code === "EHOSTUNREACH" || code === "ENETUNREACH") {
        finish(false);
        return;
      }
      finish(true);
    });
  });
}

function describeWindowsPortOccupant(host, port) {
  const script = [
    `$connection = Get-NetTCPConnection -LocalAddress '${host}' -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1`,
    'if (-not $connection) { exit 0 }',
    '$process = Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)" -ErrorAction SilentlyContinue',
    '[pscustomobject]@{ pid = $connection.OwningProcess; command = if ($process) { $process.CommandLine } else { $null } } | ConvertTo-Json -Compress',
  ].join('; ');
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-Command', script], {
    encoding: 'utf8',
    shell: false,
  });
  if (result.error || result.status !== 0) {
    return null;
  }
  const stdout = result.stdout.trim();
  if (!stdout) {
    return null;
  }
  try {
    const parsed = JSON.parse(stdout);
    return {
      pid: parsed.pid ? Number(parsed.pid) : null,
      command: typeof parsed.command === 'string' && parsed.command.trim() ? parsed.command.trim() : null,
    };
  } catch {
    return null;
  }
}

function describeUnixPortOccupant(_host, port) {
  const lsofResult = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpc'], {
    encoding: 'utf8',
    shell: false,
  });
  if (!lsofResult.error && lsofResult.status === 0) {
    const parsed = parseLsofMachineReadableOutput(lsofResult.stdout);
    if (parsed) {
      return parsed;
    }
  }

  const lsofFallback = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {
    encoding: 'utf8',
    shell: false,
  });
  if (!lsofFallback.error && lsofFallback.status === 0) {
    const lines = lsofFallback.stdout.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length >= 2) {
      const parts = lines[1].trim().split(/\s+/);
      return {
        pid: parts[1] ? Number(parts[1]) : null,
        command: parts[0] || null,
      };
    }
  }

  const ssResult = spawnSync('/bin/sh', ['-lc', `ss -ltnp '( sport = :${port} )' 2>/dev/null | tail -n +2`], {
    encoding: 'utf8',
    shell: false,
  });
  if (!ssResult.error && ssResult.status === 0) {
    const line = ssResult.stdout.trim().split(/\r?\n/).find(Boolean);
    if (line) {
      const match = line.match(/users:\(\("([^"]+)",pid=(\d+)/);
      if (match) {
        return {
          pid: Number(match[2]),
          command: match[1],
        };
      }
    }
  }

  return null;
}

async function describePortOccupant(host, port) {
  if (process.platform === 'win32') {
    return describeWindowsPortOccupant(host, port);
  }
  return describeUnixPortOccupant(host, port);
}

export async function collectPortConflicts(requiredPorts = requiredDevPorts, options = {}) {
  const probe = options.probePort ?? probePort;
  const describe = options.describePortOccupant ?? describePortOccupant;
  const conflicts = [];

  for (const requiredPort of requiredPorts) {
    const inUse = await probe(requiredPort.host, requiredPort.port);
    if (!inUse) {
      continue;
    }
    let occupant = null;
    try {
      occupant = await describe(requiredPort.host, requiredPort.port);
    } catch {
      occupant = null;
    }
    conflicts.push({
      ...requiredPort,
      occupant,
    });
  }

  return conflicts;
}

export function formatPortConflictError(conflicts) {
  const lines = ['[dev:real] 启动前端口检查失败：'];
  for (const conflict of conflicts) {
    lines.push(
      `- ${conflict.name} ${conflict.host}:${conflict.port} 已被占用 (${buildOccupantLabel(conflict.occupant)})`,
    );
  }
  lines.push('[dev:real] 请先释放这些端口，再重试 `corepack pnpm run dev:real`。这通常意味着你正连接到旧 backend / 旧 Vite 或错误数据库。');
  return lines.join('\n');
}

export async function assertRequiredPortsAvailable(requiredPorts = requiredDevPorts, options = {}) {
  const conflicts = await collectPortConflicts(requiredPorts, options);
  if (conflicts.length === 0) {
    return;
  }
  throw new Error(formatPortConflictError(conflicts));
}

async function waitForHttp(url, label, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetchWithTimeout(url, { timeoutMs: 2_000 });
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until timeout.
    }

    await delay(1_000);
  }

  throw new Error(`[dev:real] ${label} timed out after ${timeoutMs}ms`);
}

export async function stopTrackedChild(handle, options = {}) {
  if (!handle?.child || handle.child.exitCode !== null) {
    return;
  }

  const graceMs = options.graceMs ?? 10_000;
  const killMs = options.killMs ?? 2_000;

  terminateTrackedChild(handle, false);

  const exitedGracefully = await Promise.race([
    handle.exitPromise.then(() => true, () => true),
    delay(graceMs).then(() => false),
  ]);

  if (exitedGracefully) {
    return;
  }

  terminateTrackedChild(handle, true);
  await Promise.race([
    handle.exitPromise.catch(() => undefined),
    delay(killMs),
  ]);
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  const shutdownTargets = [
    ...(activeCommandHandle ? [{ name: "setup-step", ...activeCommandHandle }] : []),
    ...managedChildren,
  ];
  await Promise.allSettled(
    shutdownTargets.map((handle) => stopTrackedChild(handle, { name: handle.name })),
  );
  process.exit(exitCode);
}

function startManagedProcess(name, command, readyCheck) {
  console.log(`[dev:real] 启动 ${name}: ${command}`);
  const handle = spawnCommand(command);
  const { child, exitPromise } = handle;
  managedChildren.push({ name, ...handle });

  child.on("error", async (error) => {
    if (shuttingDown) {
      return;
    }
    console.error(`[dev:real] ${name} 启动失败:`, error instanceof Error ? error.message : error);
    await shutdown(1);
  });

  exitPromise
    .then(async ({ code, signal }) => {
      if (shuttingDown) {
        return;
      }
      const suffix = signal ? `signal ${signal}` : `exit code ${code ?? 1}`;
      console.error(`[dev:real] ${name} 意外退出: ${suffix}`);
      await shutdown(code ?? 1);
    })
    .catch(async (error) => {
      if (shuttingDown) {
        return;
      }
      console.error(`[dev:real] ${name} 退出异常:`, error instanceof Error ? error.message : error);
      await shutdown(1);
    });

  return readyCheck();
}

export async function main() {
  const { host, port } = parseDatabaseAddress(defaultDatabaseUrl);

  process.on("SIGINT", () => {
    void shutdown(0);
  });
  process.on("SIGTERM", () => {
    void shutdown(0);
  });

  await assertRequiredPortsAvailable();

  await runStep("启动 Postgres", "corepack pnpm run db:up");
  await waitForCommandSuccess(
    `等待 Postgres ${host}:${port}`,
    buildPostgresReadyCommand(),
  );
  await runStep("执行数据库迁移", "corepack pnpm run db:migrate");
  await runStep("执行开发 bootstrap", "corepack pnpm run db:bootstrap-dev");

  await startManagedProcess("backend", "node tooling/scripts/run-backend-dev.mjs", () =>
    waitForHttp(backendHealthUrl, `等待 backend ${backendHealthUrl}`),
  );
  await startManagedProcess(
    "admin",
    "corepack pnpm --filter @hualala/admin exec vite --host 127.0.0.1 --port 4173 --strictPort",
    () => waitForHttp(adminUrl, `等待 admin ${adminUrl}`),
  );
  await startManagedProcess(
    "creator",
    "corepack pnpm --filter @hualala/creator exec vite --host 127.0.0.1 --port 4174 --strictPort",
    () => waitForHttp(creatorUrl, `等待 creator ${creatorUrl}`),
  );

  console.log("[dev:real] 本地真实联调已就绪");
  console.log(`[dev:real] backend health: ${backendHealthUrl}`);
  console.log(`[dev:real] admin: ${adminUrl}`);
  console.log(`[dev:real] creator: ${creatorUrl}`);
  console.log("[dev:real] 如需注入演示数据，请执行: corepack pnpm run dev:real:seed");

  await new Promise(() => {});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await shutdown(1);
  });
}
