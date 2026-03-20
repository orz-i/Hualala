import { once } from "node:events";
import { spawn } from "node:child_process";
import { join } from "node:path";

type BackendSeedResult = {
  admin: {
    orgId: string;
    projectId: string;
    shotExecutionId: string;
  };
  creatorShot: {
    projectId: string;
    shotId: string;
    shotExecutionId: string;
  };
  creatorImport: {
    projectId: string;
    shotId: string;
    shotExecutionId: string;
    importBatchId: string;
  };
  urls: {
    admin: string;
    creatorShot: string;
    creatorImport: string;
  };
};

export async function runBackendSeed(baseUrl = "http://127.0.0.1:8080"): Promise<BackendSeedResult> {
  const scriptPath = join(process.cwd(), "tooling", "scripts", "backend_seed.mjs");
  const child = spawn(process.execPath, [scriptPath, "--base-url", baseUrl], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });

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

  const [code] = await once(child, "close");
  if (code !== 0) {
    throw new Error(stderr.trim() || stdout.trim() || `backend seed failed with code ${code}`);
  }

  return JSON.parse(stdout) as BackendSeedResult;
}
