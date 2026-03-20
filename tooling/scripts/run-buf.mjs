import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");
const cacheDir = resolve(repoRoot, "_tmp_buf-cache");
const bufEntrypoint = resolve(repoRoot, "node_modules", "@bufbuild", "buf", "bin", "buf");

mkdirSync(cacheDir, { recursive: true });

const result = spawnSync(process.execPath, [bufEntrypoint, ...process.argv.slice(2)], {
  cwd: repoRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    BUF_CACHE_DIR: process.env.BUF_CACHE_DIR || cacheDir
  }
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
