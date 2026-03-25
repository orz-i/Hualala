import type { ConsentStatus } from "./types.ts";

type ReuseAssetState = {
  assetId: string;
  uploadFileId: string;
  variantId: string;
  sourceProjectId: string;
  importBatchId: string;
  fileName: string;
  mimeType: string;
  rightsStatus: string;
  consentStatus: ConsentStatus;
  locale: string;
  aiAnnotated: boolean;
  sourceRunId: string;
};

export type AssetReuseState = {
  targetProjectId: string;
  sourceProjectId: string;
  shotWorkbench: {
    shotExecution: {
      id: string;
      shotId: string;
      orgId: string;
      projectId: string;
      status: string;
      primaryAssetId: string;
    };
    candidateAssets: Array<{
      id: string;
      assetId: string;
      shotExecutionId: string;
      sourceRunId: string;
    }>;
    reviewSummary: {
      latestConclusion: string;
    };
    latestEvaluationRun: {
      id: string;
      status: string;
    };
    reviewTimeline: {
      evaluationRuns: unknown[];
      shotReviews: unknown[];
    };
  };
  reusableAssets: ReuseAssetState[];
};

function normalizeConsentStatus(aiAnnotated: boolean, consentStatus: string) {
  const normalized = consentStatus.trim() || "unknown";
  if (!aiAnnotated && normalized === "unknown") {
    return "not_required";
  }
  return normalized;
}

function evaluateReuseAssetPolicy(targetProjectId: string, asset: ReuseAssetState) {
  const normalizedConsentStatus = normalizeConsentStatus(asset.aiAnnotated, asset.consentStatus);

  if (!asset.sourceProjectId) {
    return {
      allowed: false,
      blockedReason: "policyapp: source project is unavailable for cross-project reuse",
      consentStatus: normalizedConsentStatus,
    };
  }

  if (asset.sourceProjectId === targetProjectId) {
    return {
      allowed: false,
      blockedReason: "policyapp: asset belongs to the current project",
      consentStatus: normalizedConsentStatus,
    };
  }

  if (asset.rightsStatus !== "clear") {
    return {
      allowed: false,
      blockedReason: "policyapp: rights status does not allow cross-project reuse",
      consentStatus: normalizedConsentStatus,
    };
  }

  if (asset.aiAnnotated && normalizedConsentStatus !== "granted") {
    return {
      allowed: false,
      blockedReason: "policyapp: consent status must be granted for ai_annotated assets",
      consentStatus: normalizedConsentStatus,
    };
  }

  return {
    allowed: true,
    blockedReason: "",
    consentStatus: normalizedConsentStatus,
  };
}

export function createAssetReuseState(targetProjectId: string): AssetReuseState {
  return {
    targetProjectId,
    sourceProjectId: "project-source-9",
    shotWorkbench: {
      shotExecution: {
        id: "shot-exec-reuse-1",
        shotId: "shot-reuse-1",
        orgId: "org-live-1",
        projectId: targetProjectId,
        status: "primary_selected",
        primaryAssetId: "asset-current-1",
      },
      candidateAssets: [],
      reviewSummary: {
        latestConclusion: "approved",
      },
      latestEvaluationRun: {
        id: "eval-reuse-1",
        status: "passed",
      },
      reviewTimeline: {
        evaluationRuns: [],
        shotReviews: [],
      },
    },
    reusableAssets: [
      {
        assetId: "asset-external-1",
        uploadFileId: "upload-file-external-1",
        variantId: "variant-external-1",
        sourceProjectId: "project-source-9",
        importBatchId: "reuse-batch-source-9",
        fileName: "external-hero.png",
        mimeType: "image/png",
        rightsStatus: "clear",
        consentStatus: "not_required",
        locale: "zh-CN",
        aiAnnotated: false,
        sourceRunId: "run-source-1",
      },
      {
        assetId: "asset-external-ai-1",
        uploadFileId: "upload-file-external-ai-1",
        variantId: "variant-external-ai-1",
        sourceProjectId: "project-source-9",
        importBatchId: "reuse-batch-source-9",
        fileName: "external-ai.png",
        mimeType: "image/png",
        rightsStatus: "clear",
        consentStatus: "unknown",
        locale: "zh-CN",
        aiAnnotated: true,
        sourceRunId: "run-source-ai-1",
      },
      {
        assetId: "asset-external-ai-granted-1",
        uploadFileId: "upload-file-external-ai-granted-1",
        variantId: "variant-external-ai-granted-1",
        sourceProjectId: "project-source-9",
        importBatchId: "reuse-batch-source-9",
        fileName: "external-ai-granted.png",
        mimeType: "image/png",
        rightsStatus: "clear",
        consentStatus: "granted",
        locale: "zh-CN",
        aiAnnotated: true,
        sourceRunId: "run-source-ai-granted-1",
      },
    ],
  };
}

export function buildReuseImportBatchSummaries(reuseState: AssetReuseState, projectId: string) {
  if (!projectId || projectId !== reuseState.sourceProjectId) {
    return [];
  }

  return [
    {
      id: "reuse-batch-source-9",
      projectId: reuseState.sourceProjectId,
      sourceType: "upload_session",
      status: "confirmed",
    },
  ];
}

export function buildReuseImportBatchWorkbenchPayload(
  reuseState: AssetReuseState,
  importBatchId: string,
) {
  if (importBatchId !== "reuse-batch-source-9") {
    return null;
  }

  return {
    importBatch: {
      id: "reuse-batch-source-9",
      orgId: "org-live-1",
      projectId: reuseState.sourceProjectId,
      operatorId: "user-live-1",
      sourceType: "upload_session",
      status: "confirmed",
    },
    uploadFiles: reuseState.reusableAssets.map((asset) => ({
      id: asset.uploadFileId,
      uploadSessionId: `upload-session-${asset.assetId}`,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      checksum: `sha256:${asset.assetId}`,
      sizeBytes: 2048,
    })),
    mediaAssets: reuseState.reusableAssets.map((asset) => {
      const policy = evaluateReuseAssetPolicy(reuseState.targetProjectId, asset);
      return {
        id: asset.assetId,
        projectId: asset.sourceProjectId,
        sourceType: "upload_session",
        rightsStatus: asset.rightsStatus,
        consentStatus: policy.consentStatus,
        importBatchId: asset.importBatchId,
        locale: asset.locale,
        aiAnnotated: asset.aiAnnotated,
        mediaType: "image",
      };
    }),
    mediaAssetVariants: reuseState.reusableAssets.map((asset) => ({
      id: asset.variantId,
      assetId: asset.assetId,
      uploadFileId: asset.uploadFileId,
      variantType: "master",
      mimeType: asset.mimeType,
      width: 1920,
      height: 1080,
    })),
    candidateAssets: reuseState.reusableAssets.map((asset, index) => ({
      id: `candidate-reuse-${index + 1}`,
      assetId: asset.assetId,
      shotExecutionId: reuseState.shotWorkbench.shotExecution.id,
      sourceRunId: asset.sourceRunId,
    })),
    shotExecutions: [],
  };
}

export function buildReuseAssetProvenancePayload(
  reuseState: AssetReuseState,
  assetId: string,
) {
  const asset = reuseState.reusableAssets.find((candidate) => candidate.assetId === assetId);
  if (!asset) {
    return null;
  }
  const policy = evaluateReuseAssetPolicy(reuseState.targetProjectId, asset);

  return {
    asset: {
      id: asset.assetId,
      projectId: asset.sourceProjectId,
      sourceType: "upload_session",
      rightsStatus: asset.rightsStatus,
      consentStatus: policy.consentStatus,
      importBatchId: asset.importBatchId,
      locale: asset.locale,
      aiAnnotated: asset.aiAnnotated,
    },
    provenanceSummary: `source_type=upload_session import_batch_id=${asset.importBatchId} rights_status=${asset.rightsStatus} consent_status=${policy.consentStatus}`,
    candidateAssetId: `candidate-${asset.assetId}`,
    shotExecutionId: reuseState.shotWorkbench.shotExecution.id,
    sourceRunId: asset.sourceRunId,
    importBatchId: asset.importBatchId,
    variantCount: 1,
  };
}

export function buildReuseShotExecutionPayload(reuseState: AssetReuseState) {
  return {
    shotExecution: {
      id: reuseState.shotWorkbench.shotExecution.id,
      shotId: reuseState.shotWorkbench.shotExecution.shotId,
      projectId: reuseState.shotWorkbench.shotExecution.projectId,
      status: reuseState.shotWorkbench.shotExecution.status,
      primaryAssetId: reuseState.shotWorkbench.shotExecution.primaryAssetId,
    },
  };
}

export function buildReuseShotWorkbenchPayload(reuseState: AssetReuseState) {
  return {
    workbench: {
      shotExecution: {
        id: reuseState.shotWorkbench.shotExecution.id,
        shotId: reuseState.shotWorkbench.shotExecution.shotId,
        orgId: reuseState.shotWorkbench.shotExecution.orgId,
        projectId: reuseState.shotWorkbench.shotExecution.projectId,
        status: reuseState.shotWorkbench.shotExecution.status,
        primaryAssetId: reuseState.shotWorkbench.shotExecution.primaryAssetId,
      },
      candidateAssets: reuseState.shotWorkbench.candidateAssets,
      reviewSummary: reuseState.shotWorkbench.reviewSummary,
      latestEvaluationRun: reuseState.shotWorkbench.latestEvaluationRun,
    },
  };
}

export function applyReusePrimaryAsset(
  reuseState: AssetReuseState,
  assetId: string,
): AssetReuseState {
  return {
    ...reuseState,
    shotWorkbench: {
      ...reuseState.shotWorkbench,
      shotExecution: {
        ...reuseState.shotWorkbench.shotExecution,
        primaryAssetId: assetId,
      },
    },
  };
}

export function canApplyReuseAsset(reuseState: AssetReuseState, assetId: string) {
  const matchedAsset = reuseState.reusableAssets.find((asset) => asset.assetId === assetId);
  return matchedAsset
    ? evaluateReuseAssetPolicy(reuseState.targetProjectId, matchedAsset)
    : {
        allowed: false,
        blockedReason: "policyapp: asset not found for reuse",
        consentStatus: "unknown",
      };
}
