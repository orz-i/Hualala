import type { AssetProvenanceDetailViewModel } from "../assetMonitor";

export type AdminAssetReuseAuditViewModel = {
  shotExecution: {
    id: string;
    shotId: string;
    projectId: string;
    status: string;
    primaryAssetId: string;
  };
  assetProvenanceDetail: AssetProvenanceDetailViewModel | null;
  summary: {
    isCrossProject: boolean;
    isEligible: boolean;
    blockedReason: string;
    sourceProjectId: string;
  };
};

function decideAdminReuseEligibility(
  targetProjectId: string,
  assetProvenanceDetail: AssetProvenanceDetailViewModel | null,
) {
  const sourceProjectId = assetProvenanceDetail?.asset.projectId ?? "";
  const isCrossProject = Boolean(sourceProjectId) && sourceProjectId !== targetProjectId;

  if (!assetProvenanceDetail) {
    return {
      isCrossProject: false,
      isEligible: false,
      blockedReason: "",
      sourceProjectId,
    };
  }

  if (!sourceProjectId) {
    return {
      isCrossProject: false,
      isEligible: false,
      blockedReason: "policyapp: source project is unavailable for cross-project reuse",
      sourceProjectId,
    };
  }

  if (!isCrossProject) {
    return {
      isCrossProject: false,
      isEligible: false,
      blockedReason: "",
      sourceProjectId,
    };
  }

  if (assetProvenanceDetail?.asset.rightsStatus !== "clear") {
    return {
      isCrossProject: true,
      isEligible: false,
      blockedReason: "policyapp: rights status does not allow cross-project reuse",
      sourceProjectId,
    };
  }

  const normalizedConsentStatus =
    assetProvenanceDetail?.asset.consentStatus ||
    (assetProvenanceDetail?.asset.aiAnnotated ? "unknown" : "not_required");
  if (assetProvenanceDetail.asset.aiAnnotated && normalizedConsentStatus !== "granted") {
    return {
      isCrossProject: true,
      isEligible: false,
      blockedReason: "policyapp: consent status must be granted for ai_annotated assets",
      sourceProjectId,
    };
  }

  return {
    isCrossProject: true,
    isEligible: true,
    blockedReason: "",
    sourceProjectId,
  };
}

export function normalizeAdminAssetReuseAudit({
  shotExecution,
  assetProvenanceDetail,
}: {
  shotExecution: {
    id: string;
    shotId: string;
    projectId: string;
    status: string;
    primaryAssetId: string;
  };
  assetProvenanceDetail: AssetProvenanceDetailViewModel | null;
}): AdminAssetReuseAuditViewModel {
  return {
    shotExecution,
    assetProvenanceDetail,
    summary: decideAdminReuseEligibility(shotExecution.projectId, assetProvenanceDetail),
  };
}
