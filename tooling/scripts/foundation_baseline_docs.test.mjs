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

  assert.match(foundationDoc, /proto\/hualala\/\*\*\/\*\.proto/);
  assert.match(foundationDoc, /apps\/backend\/internal\/interfaces\/connect\/server\.go/);
  assert.match(foundationDoc, /packages\/sdk\/src\/session\/bootstrap\.ts/);
  assert.match(foundationDoc, /tests\/e2e\/fixtures\/mockConnectRoutes\.ts/);
  assert.match(foundationDoc, /corepack pnpm run proto:gen/);
  assert.match(foundationDoc, /corepack pnpm run test:e2e:phase1/);
});
