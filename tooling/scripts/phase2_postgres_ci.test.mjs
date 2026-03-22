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
  const dockerComposeScript = readFileSync(join(repoRoot, "tooling", "scripts", "docker_compose.mjs"), "utf8");

  assert.match(packageJson, /"db:up":\s*"node tooling\/scripts\/docker_compose\.mjs up -d"/);
  assert.match(packageJson, /"db:down":\s*"node tooling\/scripts\/docker_compose\.mjs down -v"/);
  assert.match(packageJson, /"db:migrate":\s*"go run \.\/apps\/backend\/cmd\/migrate"/);
  assert.match(compose, /image:\s*postgres:16/);
  assert.match(dockerComposeScript, /\["compose", "-f", "infra\/docker\/postgres\.compose\.yml"/);
});

test("repo exposes one-command real dev scripts and dedicated runbook", () => {
  const packageJson = readFileSync(join(repoRoot, "package.json"), "utf8");
  const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
  const runbook = readFileSync(join(repoRoot, "docs", "runbooks", "local-real-dev.md"), "utf8");
  const devRealScript = readFileSync(join(repoRoot, "tooling", "scripts", "run-dev-real.mjs"), "utf8");
  const backendDockerfile = readFileSync(join(repoRoot, "apps", "backend", "Dockerfile"), "utf8");

  assert.match(packageJson, /"dev:real":\s*"node tooling\/scripts\/run-dev-real\.mjs"/);
  assert.match(packageJson, /"dev:real:seed":\s*"corepack pnpm run demo:seed:backend"/);
  assert.match(devRealScript, /127\.0\.0\.1:8080/);
  assert.match(devRealScript, /127\.0\.0\.1:4173/);
  assert.match(devRealScript, /127\.0\.0\.1:4174/);
  assert.match(devRealScript, /tooling\/scripts\/run-backend-dev\.mjs/);
  assert.match(devRealScript, /assertRequiredPortsAvailable|collectPortConflicts/);
  assert.match(readme, /docs\/runbooks\/local-real-dev\.md/);
  assert.match(readme, /apps\/backend\/Dockerfile/);
  assert.match(runbook, /corepack pnpm run dev:real/);
  assert.match(runbook, /corepack pnpm run dev:real:seed/);
  assert.match(runbook, /http:\/\/127\.0\.0\.1:8080\/healthz/);
  assert.match(runbook, /启动前[\s\S]*8080[\s\S]*4173[\s\S]*4174/);
  assert.match(runbook, /已被占用[\s\S]*直接失败退出/);
  assert.match(runbook, /DB_DRIVER/);
  assert.match(runbook, /DATABASE_URL/);
  assert.match(runbook, /AUTO_MIGRATE/);
  assert.match(runbook, /apps\/backend\/Dockerfile/);
  assert.match(backendDockerfile, /go build -o \/out\/hualala-backend \.\/apps\/backend\/cmd\/api/);
  assert.match(backendDockerfile, /ENV DB_DRIVER=postgres/);
  assert.match(backendDockerfile, /ENV AUTO_MIGRATE=true/);
  assert.doesNotMatch(backendDockerfile, /ENV DATABASE_URL=/);
  assert.match(runbook, /必须在运行时显式注入/);
});
