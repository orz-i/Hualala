export type ReusableAssetLibraryItemViewModel = {
  assetId: string;
  sourceProjectId: string;
  importBatchId: string;
  fileName: string;
  mediaType: string;
  sourceType: string;
  rightsStatus: string;
  locale: string;
  aiAnnotated: boolean;
  sourceRunId: string;
  mimeType: string;
  allowed: boolean;
  blockedReason: string;
};

export function decideReuseEligibility({
  currentProjectId,
  sourceProjectId,
  rightsStatus,
  aiAnnotated,
}: {
  currentProjectId: string;
  sourceProjectId: string;
  rightsStatus: string;
  aiAnnotated: boolean;
}) {
  if (!sourceProjectId || sourceProjectId === currentProjectId) {
    return {
      allowed: false,
      blockedReason: "creator: asset belongs to the current project",
    };
  }

  if (rightsStatus !== "clear") {
    return {
      allowed: false,
      blockedReason: "creator: rights status does not allow cross-project reuse",
    };
  }

  if (aiAnnotated) {
    return {
      allowed: false,
      blockedReason: "creator: consent status is unavailable for ai_annotated assets",
    };
  }

  return {
    allowed: true,
    blockedReason: "",
  };
}
