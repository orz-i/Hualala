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
  assert.match(entry, /mock connect route not implemented/);
  assert.doesNotMatch(entry, /await route\.continue\(\)/);
  assert.doesNotMatch(entry, /function withGovernance\(/);
  assert.doesNotMatch(entry, /function buildImportBatchWorkbenchPayload\(/);
  assert.doesNotMatch(entry, /function buildAssetProvenancePayload\(/);
});

test("backend connect contract tests are split into suites instead of one monolith", () => {
  const serverTest = readFileSync(
    join(repoRoot, "apps", "backend", "internal", "interfaces", "connect", "server_test.go"),
    "utf8",
  );
  const helperTest = readFileSync(
    join(repoRoot, "apps", "backend", "internal", "interfaces", "connect", "server_contract_helpers_test.go"),
    "utf8",
  );
  const executionSuite = readFileSync(
    join(repoRoot, "apps", "backend", "internal", "interfaces", "connect", "server_execution_asset_review_billing_test.go"),
    "utf8",
  );
  const reworkSuite = readFileSync(
    join(repoRoot, "apps", "backend", "internal", "interfaces", "connect", "server_rework_and_asset_events_test.go"),
    "utf8",
  );
  const importSuite = readFileSync(
    join(repoRoot, "apps", "backend", "internal", "interfaces", "connect", "server_import_workbench_test.go"),
    "utf8",
  );
  const assetSuite = readFileSync(
    join(repoRoot, "apps", "backend", "internal", "interfaces", "connect", "server_asset_monitor_test.go"),
    "utf8",
  );
  const shotSuite = readFileSync(
    join(repoRoot, "apps", "backend", "internal", "interfaces", "connect", "server_shot_workbench_test.go"),
    "utf8",
  );
  const routesSuite = readFileSync(
    join(repoRoot, "apps", "backend", "internal", "interfaces", "connect", "server_routes_test.go"),
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

  assert.doesNotMatch(helperTest, /func testExecutionAssetReviewBillingRoutes/);
  assert.doesNotMatch(helperTest, /func testMarkShotReworkRequiredPublishesShotExecutionUpdated/);
  assert.doesNotMatch(helperTest, /func testImportBatchWorkbenchIncludesUploadArtifacts/);
  assert.doesNotMatch(helperTest, /func testImportBatchWorkbenchIncludesShotExecutionState/);
  assert.doesNotMatch(helperTest, /func testAddCandidateAssetPublishesShotExecutionUpdated/);
  assert.doesNotMatch(helperTest, /func testAddCandidateAssetRejectsScopeMismatch/);
  assert.doesNotMatch(helperTest, /func testAssetMonitorRoutesExposeImportBatchSummariesAndStructuredProvenance/);
  assert.doesNotMatch(helperTest, /func testAssetServiceWritesPublishImportBatchProjectEvents/);
  assert.doesNotMatch(helperTest, /func testGetShotWorkbenchIncludesCandidateAndReviewSummary/);
  assert.doesNotMatch(helperTest, /func testServerRouteDependenciesDoNotExposeRawMemoryStore/);
  assert.doesNotMatch(helperTest, /func testCmdAPIAvoidsRepositorySetConstruction/);

  assert.doesNotMatch(executionSuite, /testExecutionAssetReviewBillingRoutes\(t\)/);
  assert.doesNotMatch(reworkSuite, /testMarkShotReworkRequiredPublishesShotExecutionUpdated\(t\)/);
  assert.doesNotMatch(reworkSuite, /testAddCandidateAssetPublishesShotExecutionUpdated\(t\)/);
  assert.doesNotMatch(importSuite, /testImportBatchWorkbenchIncludesUploadArtifacts\(t\)/);
  assert.doesNotMatch(importSuite, /testImportBatchWorkbenchIncludesShotExecutionState\(t\)/);
  assert.doesNotMatch(assetSuite, /testAssetMonitorRoutesExposeImportBatchSummariesAndStructuredProvenance\(t\)/);
  assert.doesNotMatch(assetSuite, /testAssetServiceWritesPublishImportBatchProjectEvents\(t\)/);
  assert.doesNotMatch(shotSuite, /testGetShotWorkbenchIncludesCandidateAndReviewSummary\(t\)/);
  assert.doesNotMatch(routesSuite, /testServerRouteDependenciesDoNotExposeRawMemoryStore\(t\)/);
  assert.doesNotMatch(routesSuite, /testCmdAPIAvoidsRepositorySetConstruction\(t\)/);
});
