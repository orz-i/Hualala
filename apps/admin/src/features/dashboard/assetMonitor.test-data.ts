export function createAssetMonitor(projectId: string) {
  return {
    filters: {
      status: "",
      sourceType: "",
    },
    importBatches: [
      {
        id: "import-batch-1",
        orgId: "org-live-1",
        projectId,
        operatorId: "user-live-1",
        sourceType: "upload_session",
        status: "confirmed",
        uploadSessionCount: 2,
        itemCount: 3,
        confirmedItemCount: 1,
        candidateAssetCount: 1,
        mediaAssetCount: 1,
        updatedAt: "2024-03-09T16:05:00.000Z",
      },
    ],
  };
}

export function createAssetBatchDetail(projectId: string) {
  return {
    batch: {
      id: "import-batch-1",
      orgId: "org-live-1",
      projectId,
      operatorId: "user-live-1",
      sourceType: "upload_session",
      status: "confirmed",
    },
    uploadSessions: [
      {
        id: "upload-session-1",
        fileName: "hero.png",
        checksum: "sha256:abc",
        sizeBytes: 12345,
        retryCount: 1,
        status: "completed",
        resumeHint: "resume-1",
      },
    ],
    items: [
      {
        id: "import-item-1",
        status: "confirmed",
        assetId: "media-asset-1",
      },
    ],
    candidateAssets: [
      {
        id: "candidate-1",
        shotExecutionId: "shot-exec-1",
        assetId: "media-asset-1",
        sourceRunId: "workflow-run-1",
      },
    ],
    mediaAssets: [
      {
        id: "media-asset-1",
        projectId,
        sourceType: "upload_session",
        rightsStatus: "clear",
        consentStatus: "granted",
        importBatchId: "import-batch-1",
        locale: "zh-CN",
        aiAnnotated: true,
      },
    ],
    shotExecutions: [
      {
        id: "shot-exec-1",
        shotId: "shot-1",
        status: "candidate_ready",
        primaryAssetId: "media-asset-1",
        currentRunId: "workflow-run-1",
      },
    ],
  };
}

export function createAssetProvenanceDetail(projectId: string) {
  return {
    asset: {
      id: "media-asset-1",
      projectId,
      sourceType: "upload_session",
      rightsStatus: "clear",
      consentStatus: "granted",
      importBatchId: "import-batch-1",
      locale: "zh-CN",
      aiAnnotated: true,
    },
    provenanceSummary:
      "source_type=upload_session import_batch_id=import-batch-1 rights_status=clear consent_status=granted",
    candidateAssetId: "candidate-1",
    shotExecutionId: "shot-exec-1",
    sourceRunId: "workflow-run-1",
    importBatchId: "import-batch-1",
    variantCount: 2,
  };
}
