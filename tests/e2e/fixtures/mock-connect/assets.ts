import type {
  AdminState,
  CreatorImportState,
  CreatorShotState,
  MockWorkflowRun,
} from "./types.ts";

export function buildImportBatchSummary({
  adminState,
  creatorImportState,
}: {
  adminState: AdminState;
  creatorImportState: CreatorImportState;
}) {
  return {
    id: creatorImportState.importBatch.id,
    orgId: adminState.governance.currentSession.orgId,
    projectId: adminState.budgetSnapshot.projectId,
    operatorId: adminState.governance.currentSession.userId,
    sourceType: creatorImportState.importBatch.sourceType,
    status: creatorImportState.importBatch.status,
    uploadSessionCount: creatorImportState.uploadSessions.length,
    itemCount: creatorImportState.items.length,
    confirmedItemCount: creatorImportState.items.filter((item) => item.status === "confirmed").length,
    candidateAssetCount: creatorImportState.candidateAssets.length,
    mediaAssetCount: Array.from(
      new Set(creatorImportState.items.map((item) => item.assetId).filter(Boolean)),
    ).length,
    updatedAt: "2024-03-09T16:10:00.000Z",
  };
}

export function buildImportBatchWorkbenchPayload({
  adminState,
  creatorShotState,
  creatorImportState,
  workflowRuns,
}: {
  adminState: AdminState;
  creatorShotState: CreatorShotState;
  creatorImportState: CreatorImportState;
  workflowRuns: MockWorkflowRun[];
}) {
  const projectId = adminState.budgetSnapshot.projectId;
  const orgId = adminState.governance.currentSession.orgId;
  const operatorId = adminState.governance.currentSession.userId;
  const shotExecutionId = creatorShotState.workbench.shotExecution.id;
  const shotId = creatorShotState.workbench.shotExecution.shotId;
  const sourceRunId = workflowRuns[0]?.id ?? "workflow-run-1";
  const assetIds = Array.from(
    new Set(
      [
        ...creatorImportState.items.map((item) => item.assetId),
        ...creatorImportState.candidateAssets.map((candidate) => candidate.assetId),
        ...creatorImportState.shotExecutions.map((execution) => execution.primaryAssetId),
      ].filter(Boolean),
    ),
  );

  return {
    importBatch: {
      id: creatorImportState.importBatch.id,
      orgId,
      projectId,
      operatorId,
      sourceType: creatorImportState.importBatch.sourceType,
      status: creatorImportState.importBatch.status,
    },
    uploadSessions: creatorImportState.uploadSessions.map((session, index) => ({
      id: session.id,
      fileName: `upload-${index + 1}.png`,
      checksum: `sha256:${session.id}`,
      sizeBytes: 2048 + index,
      retryCount: 0,
      status: session.status,
      resumeHint: `resume-${session.id}`,
    })),
    items: creatorImportState.items.map((item) => ({
      id: item.id,
      status: item.status,
      assetId: item.assetId,
    })),
    candidateAssets: creatorImportState.candidateAssets.map((candidate) => ({
      id: candidate.id,
      shotExecutionId,
      assetId: candidate.assetId,
      sourceRunId,
    })),
    mediaAssets: assetIds.map((assetId) => ({
      id: assetId,
      projectId,
      sourceType: creatorImportState.importBatch.sourceType,
      rightsStatus: "clear",
      importBatchId: creatorImportState.importBatch.id,
      locale: "zh-CN",
      aiAnnotated: true,
    })),
    shotExecutions: creatorImportState.shotExecutions.map((execution) => ({
      id: execution.id,
      shotId,
      status: execution.status,
      primaryAssetId: execution.primaryAssetId,
      currentRunId: sourceRunId,
    })),
  };
}

export function buildAssetProvenancePayload({
  adminState,
  creatorShotState,
  creatorImportState,
  workflowRuns,
  assetId,
}: {
  adminState: AdminState;
  creatorShotState: CreatorShotState;
  creatorImportState: CreatorImportState;
  workflowRuns: MockWorkflowRun[];
  assetId: string;
}) {
  const sourceRunId = workflowRuns[0]?.id ?? "workflow-run-1";
  const candidateAsset = creatorImportState.candidateAssets.find(
    (candidate) => candidate.assetId === assetId,
  );

  return {
    asset: {
      id: assetId,
      projectId: adminState.budgetSnapshot.projectId,
      sourceType: creatorImportState.importBatch.sourceType,
      rightsStatus: "clear",
      importBatchId: creatorImportState.importBatch.id,
      locale: "zh-CN",
      aiAnnotated: true,
    },
    provenanceSummary: `source_type=${creatorImportState.importBatch.sourceType} import_batch_id=${creatorImportState.importBatch.id} rights_status=clear`,
    candidateAssetId: candidateAsset?.id ?? "",
    shotExecutionId: creatorShotState.workbench.shotExecution.id,
    sourceRunId,
    importBatchId: creatorImportState.importBatch.id,
    variantCount: 2,
  };
}
