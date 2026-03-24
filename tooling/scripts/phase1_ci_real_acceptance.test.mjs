import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();

function read(relativePath) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

test("ci workflow includes a dedicated real backend acceptance job", () => {
  const workflow = read(".github/workflows/ci.yml");

  assert.match(workflow, /^  e2e_real:\s*$/m);
  assert.match(workflow, /name:\s+Phase1 real acceptance/);
  assert.match(workflow, /corepack pnpm run test:e2e:phase1:real/);
});

test("phase1 docs treat real acceptance as an official quality gate", () => {
  const testsReadme = read("tests/README.md");
  const runbook = read("docs/runbooks/phase1-demo.md");
  const plan = read("docs/superpowers/plans/2026-03-20-ai-series-platform-phase1-implementation-plan.md");

  assert.match(testsReadme, /CI.*真实 backend acceptance|真实 backend acceptance.*CI/);
  assert.match(runbook, /正式质量门/);
  assert.match(plan, /phase1:real|真实 acceptance|真实 backend acceptance/);
});

test("repo exposes phase2 mock and real acceptance entrypoints", () => {
  const packageJson = read("package.json");
  const readme = read("README.md");
  const testsReadme = read("tests/README.md");

  assert.match(packageJson, /"test:e2e:phase2:collaboration":/);
  assert.match(packageJson, /"test:e2e:phase2":/);
  assert.match(packageJson, /"test:e2e:phase2:preview:real":/);
  assert.match(packageJson, /"test:e2e:phase2:audio:real":/);
  assert.match(packageJson, /"test:e2e:phase2:real":/);
  assert.match(readme, /test:e2e:phase2/);
  assert.match(readme, /test:e2e:phase2:real/);
  assert.match(testsReadme, /test:e2e:phase2/);
  assert.match(testsReadme, /test:e2e:phase2:real/);
});
