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

test("collaboration and preview shared truth stay on foundation proto, sdk, and migration entry points", () => {
  const contentProto = readFileSync(join(repoRoot, "proto", "hualala", "content", "v1", "content.proto"), "utf8");
  const projectProto = readFileSync(
    join(repoRoot, "proto", "hualala", "project", "v1", "project_service.proto"),
    "utf8",
  );
  const assetProto = readFileSync(join(repoRoot, "proto", "hualala", "asset", "v1", "asset.proto"), "utf8");
  const workflowProto = readFileSync(join(repoRoot, "proto", "hualala", "workflow", "v1", "workflow.proto"), "utf8");
  const sdkIndex = readFileSync(join(repoRoot, "packages", "sdk", "src", "index.ts"), "utf8");
  const contractFreeze = readFileSync(join(repoRoot, "docs", "runbooks", "phase2-contract-freeze.md"), "utf8");

  const expectedFiles = [
    "packages/sdk/src/connect/services/content.ts",
    "packages/sdk/src/connect/services/project.ts",
    "infra/migrations/0015_phase2_collab_preview_shared_truth.sql",
  ];
  for (const relativePath of expectedFiles) {
    assert.equal(existsSync(join(repoRoot, ...relativePath.split("/"))), true, `${relativePath} should exist`);
  }

  const contentService = readFileSync(
    join(repoRoot, "packages", "sdk", "src", "connect", "services", "content.ts"),
    "utf8",
  );
  const projectService = readFileSync(
    join(repoRoot, "packages", "sdk", "src", "connect", "services", "project.ts"),
    "utf8",
  );

  assert.match(contentProto, /rpc GetCollaborationSession/);
  assert.match(contentProto, /rpc UpsertCollaborationLease/);
  assert.match(contentProto, /rpc ReleaseCollaborationLease/);
  assert.match(projectProto, /rpc GetPreviewWorkbench/);
  assert.match(projectProto, /rpc UpsertPreviewAssembly/);

  assert.match(contentService, /export function createContentClient/);
  assert.match(projectService, /export function createProjectClient/);
  assert.match(sdkIndex, /export \* from "\.\/connect\/services\/content"/);
  assert.match(sdkIndex, /export \* from "\.\/connect\/services\/project"/);
  assert.match(sdkIndex, /export \* from "\.\/gen\/hualala\/content\/v1\/content_pb"/);
  assert.match(sdkIndex, /export \* from "\.\/gen\/hualala\/project\/v1\/project_service_pb"/);

  assert.match(contractFreeze, /proto\/hualala\/content\/v1\/content\.proto/);
  assert.match(contractFreeze, /proto\/hualala\/project\/v1\/project_service\.proto/);
  assert.match(contractFreeze, /packages\/sdk\/src\/connect\/services\/content\.ts/);
  assert.match(contractFreeze, /packages\/sdk\/src\/connect\/services\/project\.ts/);
  assert.match(contractFreeze, /content\.collaboration\.updated/);
  assert.match(contractFreeze, /change_kind/);
  assert.match(contractFreeze, /不扩 `asset\.proto`、`workflow\.proto`/);
  assert.match(contractFreeze, /audio/);
  assert.match(contractFreeze, /reuse/);

  assert.doesNotMatch(assetProto, /PreviewAssembly|CollaborationSession|GetPreviewWorkbench|GetCollaborationSession/);
  assert.doesNotMatch(workflowProto, /PreviewAssembly|CollaborationSession|GetPreviewWorkbench|GetCollaborationSession/);
});

test("audio shared truth stays on project and asset foundation entry points", () => {
  const projectProto = readFileSync(
    join(repoRoot, "proto", "hualala", "project", "v1", "project_service.proto"),
    "utf8",
  );
  const assetProto = readFileSync(join(repoRoot, "proto", "hualala", "asset", "v1", "asset.proto"), "utf8");
  const workflowProto = readFileSync(join(repoRoot, "proto", "hualala", "workflow", "v1", "workflow.proto"), "utf8");
  const sdkIndex = readFileSync(join(repoRoot, "packages", "sdk", "src", "index.ts"), "utf8");
  const contractFreeze = readFileSync(join(repoRoot, "docs", "runbooks", "phase2-contract-freeze.md"), "utf8");
  const foundationBaseline = readFileSync(
    join(repoRoot, "docs", "runbooks", "phase2-foundation-baseline.md"),
    "utf8",
  );
  const projectService = readFileSync(
    join(repoRoot, "packages", "sdk", "src", "connect", "services", "project.ts"),
    "utf8",
  );

  const expectedFiles = [
    "infra/migrations/0016_phase2_audio_timeline_shared_truth.sql",
  ];
  for (const relativePath of expectedFiles) {
    assert.equal(existsSync(join(repoRoot, ...relativePath.split("/"))), true, `${relativePath} should exist`);
  }

  assert.match(projectProto, /rpc GetAudioWorkbench/);
  assert.match(projectProto, /rpc UpsertAudioTimeline/);
  assert.match(projectProto, /message AudioTimeline/);
  assert.match(projectProto, /message AudioTrack/);
  assert.match(projectProto, /message AudioClip/);

  assert.match(assetProto, /string media_type =/);
  assert.match(assetProto, /uint32 duration_ms =/);

  assert.match(projectService, /getAudioWorkbench/);
  assert.match(projectService, /upsertAudioTimeline/);
  assert.match(sdkIndex, /export \* from "\.\/gen\/hualala\/project\/v1\/project_service_pb"/);
  assert.match(sdkIndex, /export \* from "\.\/gen\/hualala\/asset\/v1\/asset_pb"/);

  assert.match(contractFreeze, /audio timeline/i);
  assert.match(contractFreeze, /media_type/);
  assert.match(contractFreeze, /duration_ms/);
  assert.match(foundationBaseline, /project_service\.proto/);
  assert.match(foundationBaseline, /asset\.proto/);
  assert.match(foundationBaseline, /0016_phase2_audio_timeline_shared_truth\.sql/);

  assert.doesNotMatch(workflowProto, /AudioTimeline|GetAudioWorkbench|UpsertAudioTimeline/);
});
