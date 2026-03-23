import test from "node:test";
import assert from "node:assert/strict";

test("governance helpers recompute member counts and capabilities from roles", async () => {
  const { buildGovernanceBaseline, syncGovernanceState, withRecentChanges } = await import(
    "../../tests/e2e/fixtures/mock-connect/governance.ts"
  );

  const baseline = buildGovernanceBaseline();
  const updated = syncGovernanceState({
    ...baseline,
    members: [...baseline.members, { memberId: "member-2", orgId: baseline.currentSession.orgId, userId: "user-2", roleId: "role-viewer" }],
    currentSession: {
      ...baseline.currentSession,
      roleId: "role-viewer",
    },
  });

  assert.equal(updated.roles.find((role) => role.roleId === "role-admin")?.memberCount, 1);
  assert.equal(updated.roles.find((role) => role.roleId === "role-viewer")?.memberCount, 1);
  assert.deepEqual(updated.currentSession.permissionCodes, ["session.read", "user.preferences.write"]);
  assert.deepEqual(updated.capabilities, {
    canManageRoles: false,
    canManageMembers: false,
    canManageOrgSettings: false,
    canManageUserPreferences: true,
  });

  const withChanges = withRecentChanges({
    budgetSnapshot: { projectId: "project-1", limitCents: 500, reservedCents: 120, remainingBudgetCents: 380 },
    usageRecords: [],
    billingEvents: [{ id: "billing-1", eventType: "reserve", amountCents: 120 }],
    reviewSummary: { shotExecutionId: "shot-execution-1", latestConclusion: "approved" },
    evaluationRuns: [{ id: "eval-1", status: "passed", failedChecks: [] }],
    shotReviews: [{ id: "review-1", conclusion: "approved" }],
    governance: updated,
  });

  assert.equal(withChanges.recentChanges[0]?.kind, "billing");
  assert.match(withChanges.recentChanges[0]?.detail ?? "", /1\.20 元/);
  assert.equal(withChanges.recentChanges[2]?.tone, "success");
});

test("workflow helpers preserve wire shape across retry and cancel transitions", async () => {
  const {
    buildInitialWorkflowRuns,
    retryWorkflowRun,
    cancelWorkflowRun,
    summarizeWorkflowRun,
  } = await import("../../tests/e2e/fixtures/mock-connect/workflow.ts");

  const initial = buildInitialWorkflowRuns({ projectId: "project-1", resourceId: "shot-execution-1" });
  assert.equal(initial[0]?.status, "failed");
  assert.equal(initial[0]?.steps[1]?.status, "failed");

  const retried = retryWorkflowRun(initial, "workflow-run-1");
  assert.equal(retried[0]?.attemptCount, 2);
  assert.equal(retried[0]?.status, "running");
  assert.equal(retried[0]?.steps[1]?.stepKey, "attempt_2.gateway");
  assert.equal(summarizeWorkflowRun(retried[0]).status, "running");

  const cancelled = cancelWorkflowRun(retried, "workflow-run-1");
  assert.equal(cancelled[0]?.status, "cancelled");
  assert.equal(cancelled[0]?.currentStep, "attempt_2.cancel");
  assert.equal(cancelled[0]?.steps.at(-1)?.stepKey, "attempt_2.cancel");
});

test("asset helpers keep import batch and provenance scope aligned", async () => {
  const {
    buildImportBatchSummary,
    buildImportBatchWorkbenchPayload,
    buildAssetProvenancePayload,
  } = await import("../../tests/e2e/fixtures/mock-connect/assets.ts");
  const { withGovernance } = await import("../../tests/e2e/fixtures/mock-connect/governance.ts");
  const { buildInitialWorkflowRuns } = await import("../../tests/e2e/fixtures/mock-connect/workflow.ts");

  const adminState = withGovernance({
    budgetSnapshot: { projectId: "project-1", limitCents: 500, reservedCents: 120, remainingBudgetCents: 380 },
    usageRecords: [],
    billingEvents: [],
    reviewSummary: { shotExecutionId: "shot-execution-1", latestConclusion: "approved" },
    evaluationRuns: [],
    shotReviews: [],
  });
  const creatorShotState = {
    workbench: {
      shotExecution: {
        id: "shot-execution-1",
        shotId: "shot-1",
        projectId: "project-1",
        orgId: adminState.governance.currentSession.orgId,
        status: "candidate_ready",
        primaryAssetId: "asset-1",
      },
      candidateAssets: [{ id: "candidate-1", assetId: "asset-1" }],
      reviewSummary: { latestConclusion: "approved" },
      latestEvaluationRun: { id: "eval-1", status: "passed" },
    },
  };
  const creatorImportState = {
    importBatch: { id: "import-batch-1", status: "matched_pending_confirm", sourceType: "manual_upload" },
    uploadSessions: [{ id: "upload-session-1", status: "completed" }],
    items: [{ id: "item-1", status: "confirmed", assetId: "asset-1" }],
    candidateAssets: [{ id: "candidate-1", assetId: "asset-1" }],
    shotExecutions: [{ id: "shot-execution-1", status: "candidate_ready", primaryAssetId: "asset-1" }],
  };
  const workflowRuns = buildInitialWorkflowRuns({ projectId: "project-1", resourceId: "shot-execution-1" });

  const summary = buildImportBatchSummary({ adminState, creatorImportState });
  assert.equal(summary.orgId, adminState.governance.currentSession.orgId);
  assert.equal(summary.projectId, adminState.budgetSnapshot.projectId);
  assert.equal(summary.confirmedItemCount, 1);

  const workbench = buildImportBatchWorkbenchPayload({
    adminState,
    creatorShotState,
    creatorImportState,
    workflowRuns,
  });
  assert.equal(workbench.importBatch.id, creatorImportState.importBatch.id);
  assert.equal(workbench.candidateAssets[0]?.sourceRunId, workflowRuns[0]?.id);
  assert.equal(workbench.shotExecutions[0]?.shotId, creatorShotState.workbench.shotExecution.shotId);

  const provenance = buildAssetProvenancePayload({
    adminState,
    creatorShotState,
    creatorImportState,
    workflowRuns,
    assetId: "asset-1",
  });
  assert.equal(provenance.asset.projectId, adminState.budgetSnapshot.projectId);
  assert.equal(provenance.importBatchId, creatorImportState.importBatch.id);
  assert.equal(provenance.shotExecutionId, creatorShotState.workbench.shotExecution.id);
  assert.equal(provenance.candidateAssetId, "candidate-1");
});

test("scenario initializer keeps admin workflow scope and mock session defaults stable", async () => {
  const { initializeMockConnectState } = await import("../../tests/e2e/fixtures/mock-connect/scenario.ts");

  const adminState = {
    budgetSnapshot: { projectId: "project-88", limitCents: 500, reservedCents: 120, remainingBudgetCents: 380 },
    usageRecords: [],
    billingEvents: [{ id: "billing-1", eventType: "reserve", amountCents: 120 }],
    reviewSummary: { shotExecutionId: "shot-execution-1", latestConclusion: "approved" },
    evaluationRuns: [{ id: "eval-1", status: "passed", failedChecks: [] }],
    shotReviews: [{ id: "review-1", conclusion: "approved" }],
  };
  const creatorShotState = {
    workbench: {
      shotExecution: {
        id: "shot-execution-1",
        shotId: "shot-1",
        projectId: "project-from-shot",
        status: "candidate_ready",
        primaryAssetId: "asset-1",
      },
      candidateAssets: [],
      reviewSummary: { latestConclusion: "pending" },
    },
  };
  const creatorImportState = {
    importBatch: { id: "import-batch-1", status: "pending_review", sourceType: "manual_upload" },
    uploadSessions: [],
    items: [],
    candidateAssets: [],
    shotExecutions: [],
  };

  const initialized = initializeMockConnectState({
    scenario: { admin: "success" },
    phase1DemoScenarios: {
      admin: { success: adminState, failure: adminState },
      creatorShot: { success: creatorShotState, failure: creatorShotState },
      creatorImport: { success: creatorImportState, failure: creatorImportState },
    },
  });

  assert.equal(initialized.devSessionActive, false);
  assert.equal(initialized.adminState.governance.currentSession.orgId, "org-live-1");
  assert.equal(initialized.creatorShotWorkflowRuns[0]?.projectId, "project-from-shot");
  assert.equal(initialized.creatorShotWorkflowRuns[0]?.resourceId, "shot-execution-1");
});
