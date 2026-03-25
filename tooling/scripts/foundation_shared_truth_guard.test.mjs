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

test("phase3 preview metadata shared truth stays on project proto and sdk entry points", () => {
  const projectProto = readFileSync(
    join(repoRoot, "proto", "hualala", "project", "v1", "project_service.proto"),
    "utf8",
  );
  const assetProto = readFileSync(join(repoRoot, "proto", "hualala", "asset", "v1", "asset.proto"), "utf8");
  const workflowProto = readFileSync(join(repoRoot, "proto", "hualala", "workflow", "v1", "workflow.proto"), "utf8");
  const projectService = readFileSync(
    join(repoRoot, "packages", "sdk", "src", "connect", "services", "project.ts"),
    "utf8",
  );
  const previewAggregation = readFileSync(
    join(repoRoot, "apps", "backend", "internal", "application", "projectapp", "service_preview_metadata.go"),
    "utf8",
  );
  const contractFreeze = readFileSync(
    join(repoRoot, "docs", "runbooks", "phase3-preview-contract-freeze.md"),
    "utf8",
  );

  const expectedFiles = [
    "docs/runbooks/phase3-preview-contract-freeze.md",
    "proto/hualala/project/v1/project_service.proto",
    "packages/sdk/src/connect/services/project.ts",
    "apps/backend/internal/application/projectapp/service_preview_metadata.go",
  ];
  for (const relativePath of expectedFiles) {
    assert.equal(existsSync(join(repoRoot, ...relativePath.split("/"))), true, `${relativePath} should exist`);
  }

  assert.match(projectProto, /rpc ListPreviewShotOptions/);
  assert.match(projectProto, /message PreviewShotSummary/);
  assert.match(projectProto, /message PreviewAssetSummary/);
  assert.match(projectProto, /message PreviewRunSummary/);
  assert.match(projectProto, /message PreviewShotOption/);
  assert.match(projectProto, /display_locale/);
  assert.match(projectProto, /PreviewShotSummary shot = 7;/);
  assert.match(projectProto, /PreviewAssetSummary primary_asset = 8;/);
  assert.match(projectProto, /PreviewRunSummary source_run = 9;/);

  assert.match(projectService, /displayLocale/);
  assert.match(projectService, /listPreviewShotOptions/);
  assert.match(previewAggregation, /ListPreviewShotOptions/);
  assert.match(previewAggregation, /buildPreviewWorkbench/);
  assert.match(previewAggregation, /listPreviewScopedScenes/);

  assert.match(contractFreeze, /ProjectService/);
  assert.match(contractFreeze, /phase3-preview-title-localization-freeze\.md/);
  assert.match(contractFreeze, /ListPreviewShotOptions/);
  assert.match(contractFreeze, /PreviewShotSummary/);
  assert.match(contractFreeze, /scene_title/);
  assert.match(contractFreeze, /shot_title/);

  assert.doesNotMatch(assetProto, /PreviewShotSummary|PreviewShotOption|ListPreviewShotOptions/);
  assert.doesNotMatch(workflowProto, /PreviewShotSummary|PreviewShotOption|ListPreviewShotOptions/);
});

test("phase3 preview title localization shared truth stays on content and project foundation entry points", () => {
  const contentProto = readFileSync(join(repoRoot, "proto", "hualala", "content", "v1", "content.proto"), "utf8");
  const projectProto = readFileSync(
    join(repoRoot, "proto", "hualala", "project", "v1", "project_service.proto"),
    "utf8",
  );
  const contentService = readFileSync(
    join(repoRoot, "packages", "sdk", "src", "connect", "services", "content.ts"),
    "utf8",
  );
  const projectService = readFileSync(
    join(repoRoot, "packages", "sdk", "src", "connect", "services", "project.ts"),
    "utf8",
  );
  const contentApp = readFileSync(
    join(repoRoot, "apps", "backend", "internal", "application", "contentapp", "service.go"),
    "utf8",
  );
  const titleLocalization = readFileSync(
    join(repoRoot, "apps", "backend", "internal", "application", "contentapp", "service_title_localization.go"),
    "utf8",
  );
  const previewAggregation = readFileSync(
    join(repoRoot, "apps", "backend", "internal", "application", "projectapp", "service_preview_metadata.go"),
    "utf8",
  );
  const freezeDoc = readFileSync(
    join(repoRoot, "docs", "runbooks", "phase3-preview-title-localization-freeze.md"),
    "utf8",
  );

  const expectedFiles = [
    "docs/runbooks/phase3-preview-title-localization-freeze.md",
    "proto/hualala/content/v1/content.proto",
    "proto/hualala/project/v1/project_service.proto",
    "packages/sdk/src/connect/services/content.ts",
    "packages/sdk/src/connect/services/project.ts",
    "apps/backend/internal/application/contentapp/service.go",
    "apps/backend/internal/application/contentapp/service_title_localization.go",
    "apps/backend/internal/application/projectapp/service_preview_metadata.go",
  ];
  for (const relativePath of expectedFiles) {
    assert.equal(existsSync(join(repoRoot, ...relativePath.split("/"))), true, `${relativePath} should exist`);
  }

  assert.match(contentProto, /string snapshot_kind =/);
  assert.match(contentProto, /CreateContentSnapshotRequest/);
  assert.match(contentProto, /CreateLocalizedSnapshotRequest/);
  assert.match(contentProto, /display_locale/);

  assert.match(projectProto, /GetPreviewWorkbenchRequest/);
  assert.match(projectProto, /ListPreviewShotOptionsRequest/);
  assert.match(projectProto, /display_locale/);

  assert.match(contentService, /listScenes/);
  assert.match(contentService, /getScene/);
  assert.match(contentService, /listSceneShots/);
  assert.match(contentService, /getShot/);
  assert.match(contentService, /createContentSnapshot/);
  assert.match(contentService, /createLocalizedSnapshot/);
  assert.match(contentService, /snapshotKind/);

  assert.match(projectService, /displayLocale/);
  assert.match(contentApp, /SnapshotKind/);
  assert.match(titleLocalization, /SnapshotKindTitle/);
  assert.match(titleLocalization, /displayLocale/);
  assert.match(previewAggregation, /displayLocale/);
  assert.match(previewAggregation, /ListSnapshotsByOwners/);

  assert.match(freezeDoc, /snapshot_kind=title/);
  assert.match(freezeDoc, /scene \/ shot/);
  assert.match(freezeDoc, /display_locale/);
  assert.match(freezeDoc, /project_title/);
  assert.match(freezeDoc, /episode_title/);
});

test("phase3 preview runtime shared truth stays on project proto, sdk, runtime app, migration, and events entry points", () => {
  const projectProto = readFileSync(
    join(repoRoot, "proto", "hualala", "project", "v1", "project_service.proto"),
    "utf8",
  );
  const workflowProto = readFileSync(join(repoRoot, "proto", "hualala", "workflow", "v1", "workflow.proto"), "utf8");
  const projectService = readFileSync(
    join(repoRoot, "packages", "sdk", "src", "connect", "services", "project.ts"),
    "utf8",
  );
  const previewRuntimeService = readFileSync(
    join(repoRoot, "apps", "backend", "internal", "application", "projectapp", "service_preview_runtime.go"),
    "utf8",
  );
  const previewEvents = readFileSync(
    join(repoRoot, "apps", "backend", "internal", "platform", "events", "events.go"),
    "utf8",
  );
  const freezeDoc = readFileSync(
    join(repoRoot, "docs", "runbooks", "phase3-preview-runtime-freeze.md"),
    "utf8",
  );
  const outputFreezeDoc = readFileSync(
    join(repoRoot, "docs", "runbooks", "phase3-preview-playback-export-freeze.md"),
    "utf8",
  );

  const expectedFiles = [
    "proto/hualala/project/v1/project_service.proto",
    "packages/sdk/src/connect/services/project.ts",
    "apps/backend/internal/application/projectapp/service_preview_runtime.go",
    "apps/backend/internal/platform/events/events.go",
    "infra/migrations/0017_phase3_preview_runtime_shared_truth.sql",
    "infra/migrations/0018_phase3_preview_runtime_outputs.sql",
    "docs/runbooks/phase3-preview-runtime-freeze.md",
    "docs/runbooks/phase3-preview-playback-export-freeze.md",
  ];
  for (const relativePath of expectedFiles) {
    assert.equal(existsSync(join(repoRoot, ...relativePath.split("/"))), true, `${relativePath} should exist`);
  }

  assert.match(projectProto, /rpc GetPreviewRuntime/);
  assert.match(projectProto, /rpc RequestPreviewRender/);
  assert.match(projectProto, /rpc ApplyPreviewRenderUpdate/);
  assert.match(projectProto, /message PreviewRuntime/);
  assert.match(projectProto, /message PreviewPlaybackDelivery/);
  assert.match(projectProto, /message PreviewExportDelivery/);
  assert.match(projectProto, /string render_workflow_run_id = 6;/);
  assert.match(projectProto, /string resolved_locale = 10;/);
  assert.match(projectProto, /PreviewPlaybackDelivery playback = 13;/);
  assert.match(projectProto, /PreviewExportDelivery export_output = 14;/);
  assert.match(projectProto, /string last_error_code = 15;/);
  assert.match(projectProto, /string last_error_message = 16;/);

  assert.match(projectService, /getPreviewRuntime/);
  assert.match(projectService, /requestPreviewRender/);
  assert.match(projectService, /applyPreviewRenderUpdate/);
  assert.match(previewRuntimeService, /GetPreviewRuntime/);
  assert.match(previewRuntimeService, /RequestPreviewRender/);
  assert.match(previewRuntimeService, /ApplyPreviewRenderUpdate/);
  assert.match(previewRuntimeService, /preview\.render_assembly/);
  assert.match(previewEvents, /project\.preview\.runtime\.updated/);
  assert.match(previewEvents, /preview_runtime_id/);
  assert.doesNotMatch(previewEvents, /playback_url|download_url|poster_url/);

  assert.match(freezeDoc, /project\.preview\.runtime\.updated/);
  assert.match(freezeDoc, /preview\.render_assembly/);
  assert.match(freezeDoc, /playback_asset_id/);
  assert.match(freezeDoc, /export_asset_id/);
  assert.match(freezeDoc, /phase3-preview-playback-export-freeze\.md/);

  assert.match(outputFreezeDoc, /ApplyPreviewRenderUpdate/);
  assert.match(outputFreezeDoc, /PreviewPlaybackDelivery/);
  assert.match(outputFreezeDoc, /PreviewExportDelivery/);
  assert.match(outputFreezeDoc, /project\.preview\.runtime\.updated/);
  assert.match(outputFreezeDoc, /delivery_mode/);
  assert.match(outputFreezeDoc, /download_url/);
  assert.match(outputFreezeDoc, /playback_url/);
  assert.match(outputFreezeDoc, /worker 只能通过 `ApplyPreviewRenderUpdate` 回写 runtime/);

  assert.doesNotMatch(workflowProto, /GetPreviewRuntime|RequestPreviewRender|PreviewRuntime/);
});

test("phase3 preview timeline spine shared truth stays on project proto, sdk, runtime app, db, and freeze entry points", () => {
  const projectProto = readFileSync(
    join(repoRoot, "proto", "hualala", "project", "v1", "project_service.proto"),
    "utf8",
  );
  const projectService = readFileSync(
    join(repoRoot, "packages", "sdk", "src", "connect", "services", "project.ts"),
    "utf8",
  );
  const previewRuntimeService = readFileSync(
    join(repoRoot, "apps", "backend", "internal", "application", "projectapp", "service_preview_runtime.go"),
    "utf8",
  );
  const previewStore = readFileSync(
    join(repoRoot, "apps", "backend", "internal", "platform", "db", "postgres_store_preview_runtime.go"),
    "utf8",
  );
  const previewRelational = readFileSync(
    join(repoRoot, "apps", "backend", "internal", "platform", "db", "postgres_relational_preview_runtime.go"),
    "utf8",
  );
  const previewEvents = readFileSync(
    join(repoRoot, "apps", "backend", "internal", "platform", "events", "events.go"),
    "utf8",
  );
  const freezeDoc = readFileSync(
    join(repoRoot, "docs", "runbooks", "phase3-preview-timeline-spine-freeze.md"),
    "utf8",
  );
  const outputFreezeDoc = readFileSync(
    join(repoRoot, "docs", "runbooks", "phase3-preview-playback-export-freeze.md"),
    "utf8",
  );
  const demoDoc = readFileSync(
    join(repoRoot, "docs", "runbooks", "phase3-preview-demo.md"),
    "utf8",
  );

  const expectedFiles = [
    "proto/hualala/project/v1/project_service.proto",
    "packages/sdk/src/connect/services/project.ts",
    "apps/backend/internal/application/projectapp/service_preview_runtime.go",
    "apps/backend/internal/platform/db/postgres_store_preview_runtime.go",
    "apps/backend/internal/platform/db/postgres_relational_preview_runtime.go",
    "apps/backend/internal/platform/events/events.go",
    "infra/migrations/0019_phase3_preview_timeline_spine.sql",
    "docs/runbooks/phase3-preview-timeline-spine-freeze.md",
  ];
  for (const relativePath of expectedFiles) {
    assert.equal(existsSync(join(repoRoot, ...relativePath.split("/"))), true, `${relativePath} should exist`);
  }

  assert.match(projectProto, /message PreviewTimelineSpine/);
  assert.match(projectProto, /message PreviewTimelineSegment/);
  assert.match(projectProto, /message PreviewTransition/);
  assert.match(projectProto, /PreviewTimelineSpine timeline = 5;/);
  assert.match(projectProto, /PreviewTransition transition_to_next = 10;/);

  assert.match(projectService, /timeline\?:/);
  assert.match(previewRuntimeService, /validatePreviewTimelineSpine/);
  assert.match(previewRuntimeService, /normalizePreviewTimelineSpine/);
  assert.match(previewStore, /playback_timeline/);
  assert.match(previewRelational, /playback_timeline/);
  assert.match(previewEvents, /project\.preview\.runtime\.updated/);
  assert.doesNotMatch(previewEvents, /timeline|segments|transition_type/);

  assert.match(freezeDoc, /playback\.timeline/);
  assert.match(freezeDoc, /ordered shot segments/);
  assert.match(freezeDoc, /optional transition summary/);
  assert.match(freezeDoc, /ApplyPreviewRenderUpdate/);
  assert.match(outputFreezeDoc, /phase3-preview-timeline-spine-freeze\.md/);
  assert.match(outputFreezeDoc, /timeline spine/);
  assert.match(demoDoc, /timeline spine/);
});
