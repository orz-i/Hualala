export type ReusableAssetLibraryItemViewModel = {
  assetId: string;
  sourceProjectId: string;
  importBatchId: string;
  fileName: string;
  mediaType: string;
  sourceType: string;
  rightsStatus: string;
  consentStatus: string;
  locale: string;
  aiAnnotated: boolean;
  sourceRunId: string;
  mimeType: string;
  allowed: boolean;
  blockedReason: string;
};

function normalizeConsentStatus(aiAnnotated: boolean, consentStatus: string) {
  const normalized = consentStatus.trim() || "unknown";
  if (!aiAnnotated && normalized === "unknown") {
    return "not_required";
  }
  return normalized;
}

export function decideReuseEligibility({
  currentProjectId,
  sourceProjectId,
  rightsStatus,
  consentStatus,
  aiAnnotated,
}: {
  currentProjectId: string;
  sourceProjectId: string;
  rightsStatus: string;
  consentStatus: string;
  aiAnnotated: boolean;
}) {
  const normalizedConsentStatus = normalizeConsentStatus(aiAnnotated, consentStatus);

  if (!sourceProjectId) {
    return {
      allowed: false,
      blockedReason: "policyapp: source project is unavailable for cross-project reuse",
      consentStatus: normalizedConsentStatus,
    };
  }

  if (sourceProjectId === currentProjectId) {
    return {
      allowed: false,
      blockedReason: "policyapp: asset belongs to the current project",
      consentStatus: normalizedConsentStatus,
    };
  }

  if (rightsStatus !== "clear") {
    return {
      allowed: false,
      blockedReason: "policyapp: rights status does not allow cross-project reuse",
      consentStatus: normalizedConsentStatus,
    };
  }

  if (aiAnnotated && normalizedConsentStatus !== "granted") {
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
