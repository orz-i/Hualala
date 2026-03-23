import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();

test("mock connect routes are split into domain modules", () => {
  const entry = readFileSync(join(repoRoot, "tests", "e2e", "fixtures", "mockConnectRoutes.ts"), "utf8");

  const expectedModules = [
    "tests/e2e/fixtures/mock-connect/types.ts",
    "tests/e2e/fixtures/mock-connect/governance.ts",
    "tests/e2e/fixtures/mock-connect/workflow.ts",
    "tests/e2e/fixtures/mock-connect/assets.ts",
    "tests/e2e/fixtures/mock-connect/scenario.ts",
  ];

  for (const relativePath of expectedModules) {
    assert.equal(existsSync(join(repoRoot, ...relativePath.split("/"))), true, `${relativePath} should exist`);
  }

  assert.match(entry, /from "\.\/mock-connect\/types(?:\.ts)?"/);
  assert.match(entry, /from "\.\/mock-connect\/governance(?:\.ts)?"/);
  assert.match(entry, /from "\.\/mock-connect\/workflow(?:\.ts)?"/);
  assert.match(entry, /from "\.\/mock-connect\/assets(?:\.ts)?"/);
  assert.match(entry, /from "\.\/mock-connect\/scenario(?:\.ts)?"/);
  assert.doesNotMatch(entry, /function withGovernance\(/);
  assert.doesNotMatch(entry, /function buildImportBatchWorkbenchPayload\(/);
  assert.doesNotMatch(entry, /function buildAssetProvenancePayload\(/);
});

test("backend connect contract tests are split into suites instead of one monolith", () => {
  const serverTest = readFileSync(
    join(repoRoot, "apps", "backend", "internal", "interfaces", "connect", "server_test.go"),
    "utf8",
  );

  const expectedSuites = [
    "apps/backend/internal/interfaces/connect/server_routes_test.go",
    "apps/backend/internal/interfaces/connect/server_contract_helpers_test.go",
    "apps/backend/internal/interfaces/connect/server_execution_asset_review_billing_test.go",
    "apps/backend/internal/interfaces/connect/server_rework_and_asset_events_test.go",
    "apps/backend/internal/interfaces/connect/server_import_workbench_test.go",
    "apps/backend/internal/interfaces/connect/server_asset_monitor_test.go",
    "apps/backend/internal/interfaces/connect/server_shot_workbench_test.go",
  ];

  for (const relativePath of expectedSuites) {
    assert.equal(existsSync(join(repoRoot, ...relativePath.split("/"))), true, `${relativePath} should exist`);
  }

  assert.doesNotMatch(serverTest, /func TestExecutionAssetReviewBillingRoutes/);
  assert.doesNotMatch(serverTest, /func TestImportBatchWorkbenchIncludesUploadArtifacts/);
  assert.doesNotMatch(serverTest, /func TestAssetMonitorRoutesExposeImportBatchSummariesAndStructuredProvenance/);
  assert.doesNotMatch(serverTest, /func TestGetShotWorkbenchIncludesCandidateAndReviewSummary/);
});
