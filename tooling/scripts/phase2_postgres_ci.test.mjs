import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();

test("ci workflow runs backend and real acceptance against postgres", () => {
  const workflow = readFileSync(join(repoRoot, ".github", "workflows", "ci.yml"), "utf8");

  assert.match(workflow, /backend:\s*\n[\s\S]*services:\s*\n[\s\S]*postgres:/);
  assert.match(workflow, /e2e_real:\s*\n[\s\S]*services:\s*\n[\s\S]*postgres:/);
  assert.match(workflow, /DB_DRIVER:\s*postgres/);
  assert.match(workflow, /DATABASE_URL:\s*postgres:\/\/hualala:hualala@127\.0\.0\.1:5432\/hualala\?sslmode=disable/);
  assert.match(workflow, /go run \.\/apps\/backend\/cmd\/migrate/);
  assert.match(workflow, /corepack pnpm run db:migrate/);
  assert.match(workflow, /corepack pnpm run test:e2e:phase1:real/);
});

test("repo exposes postgres developer scripts", () => {
  const packageJson = readFileSync(join(repoRoot, "package.json"), "utf8");
  const compose = readFileSync(join(repoRoot, "infra", "docker", "postgres.compose.yml"), "utf8");

  assert.match(packageJson, /"db:up":\s*"docker compose -f infra\/docker\/postgres\.compose\.yml up -d"/);
  assert.match(packageJson, /"db:down":\s*"docker compose -f infra\/docker\/postgres\.compose\.yml down -v"/);
  assert.match(packageJson, /"db:migrate":\s*"go run \.\/apps\/backend\/cmd\/migrate"/);
  assert.match(compose, /image:\s*postgres:16/);
});
