import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();

test("readme reflects the current phase2 foundation runtime baseline", () => {
  const readme = readFileSync(join(repoRoot, "README.md"), "utf8");

  assert.doesNotMatch(readme, /内存态 Phase 1 backend/);
  assert.match(readme, /Phase 2 foundation/i);
  assert.match(readme, /PostgreSQL/i);
  assert.match(readme, /docs\/runbooks\/phase2-foundation-baseline\.md/);
});

test("repo exposes a phase2 foundation baseline doc with shared truth sources", () => {
  const foundationDoc = readFileSync(
    join(repoRoot, "docs", "runbooks", "phase2-foundation-baseline.md"),
    "utf8",
  );

  assert.match(foundationDoc, /## 共享入口清单/);
  assert.match(foundationDoc, /## 变更准入规则/);
  assert.match(foundationDoc, /## 验证矩阵/);
  assert.match(foundationDoc, /proto\/hualala\/\*\*\/\*\.proto/);
  assert.match(foundationDoc, /apps\/backend\/internal\/interfaces\/connect\/server\.go/);
  assert.match(foundationDoc, /packages\/sdk\/src\/session\/bootstrap\.ts/);
  assert.match(foundationDoc, /tests\/e2e\/fixtures\/mockConnectRoutes\.ts/);
  assert.match(foundationDoc, /foundation patch/);
  assert.match(foundationDoc, /backend\/admin\/creator/);
  assert.match(foundationDoc, /corepack pnpm run test:tooling/);
  assert.match(foundationDoc, /go test \.\/apps\/backend\/internal\/interfaces\/connect\/\.\.\. -count=1/);
  assert.match(foundationDoc, /corepack pnpm run test:e2e:phase1:real/);
  assert.match(foundationDoc, /proto\/hualala\/content\/v1\/content\.proto/);
  assert.match(foundationDoc, /proto\/hualala\/project\/v1\/project_service\.proto/);
  assert.match(foundationDoc, /packages\/sdk\/src\/connect\/services\/content\.ts/);
  assert.match(foundationDoc, /packages\/sdk\/src\/connect\/services\/project\.ts/);
  assert.match(foundationDoc, /0015_phase2_collab_preview_shared_truth\.sql/);
});

test("repo exposes a phase2 contract freeze doc for collaboration and preview shared truth", () => {
  const freezeDoc = readFileSync(
    join(repoRoot, "docs", "runbooks", "phase2-contract-freeze.md"),
    "utf8",
  );

  assert.match(freezeDoc, /协同/);
  assert.match(freezeDoc, /session/);
  assert.match(freezeDoc, /presence/);
  assert.match(freezeDoc, /draft version/);
  assert.match(freezeDoc, /预演/);
  assert.match(freezeDoc, /preview assembly/);
  assert.match(freezeDoc, /ordered shot refs/);
  assert.match(freezeDoc, /selected primary asset refs/);
  assert.match(freezeDoc, /assembly status/);
  assert.match(freezeDoc, /不扩 `asset\.proto`、`workflow\.proto`/);
  assert.match(freezeDoc, /audio/);
  assert.match(freezeDoc, /reuse/);
});
