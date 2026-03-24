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
      blockedReason: "admin: rights status does not allow cross-project reuse",
      sourceProjectId,
    };
  }

  if (assetProvenanceDetail.asset.aiAnnotated) {
    return {
      isCrossProject: true,
      isEligible: false,
      blockedReason: "admin: consent status is unavailable for ai_annotated assets",
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
  projectId,
  shotExecution,
  assetProvenanceDetail,
}: {
  projectId: string;
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
    summary: decideAdminReuseEligibility(projectId, assetProvenanceDetail),
  };
}
