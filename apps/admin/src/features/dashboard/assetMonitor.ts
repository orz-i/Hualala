export type AssetMonitorFiltersViewModel = {
  status: string;
  sourceType: string;
};

export type ImportBatchSummaryViewModel = {
  id: string;
  orgId: string;
  projectId: string;
  operatorId: string;
  sourceType: string;
  status: string;
  uploadSessionCount: number;
  itemCount: number;
  confirmedItemCount: number;
  candidateAssetCount: number;
  mediaAssetCount: number;
  updatedAt: string;
};

export type AssetMonitorViewModel = {
  filters: AssetMonitorFiltersViewModel;
  importBatches: ImportBatchSummaryViewModel[];
};

export type ImportBatchUploadSessionViewModel = {
  id: string;
  fileName: string;
  checksum: string;
  sizeBytes: number;
  retryCount: number;
  status: string;
  resumeHint: string;
};

export type ImportBatchItemViewModel = {
  id: string;
  status: string;
  assetId: string;
};

export type ImportBatchCandidateAssetViewModel = {
  id: string;
  shotExecutionId: string;
  assetId: string;
  sourceRunId: string;
};

export type ImportBatchMediaAssetViewModel = {
  id: string;
  projectId: string;
  sourceType: string;
  rightsStatus: string;
  consentStatus: string;
  importBatchId: string;
  locale: string;
  aiAnnotated: boolean;
};

export type ImportBatchShotExecutionViewModel = {
  id: string;
  shotId: string;
  status: string;
  primaryAssetId: string;
  currentRunId: string;
};

export type ImportBatchDetailViewModel = {
  batch: {
    id: string;
    orgId: string;
    projectId: string;
    operatorId: string;
    sourceType: string;
    status: string;
  };
  uploadSessions: ImportBatchUploadSessionViewModel[];
  items: ImportBatchItemViewModel[];
  candidateAssets: ImportBatchCandidateAssetViewModel[];
  mediaAssets: ImportBatchMediaAssetViewModel[];
  shotExecutions: ImportBatchShotExecutionViewModel[];
};

export type AssetProvenanceDetailViewModel = {
  asset: {
    id: string;
    projectId: string;
    sourceType: string;
    rightsStatus: string;
    consentStatus: string;
    importBatchId: string;
    locale: string;
    aiAnnotated: boolean;
  };
  provenanceSummary: string;
  candidateAssetId: string;
  shotExecutionId: string;
  sourceRunId: string;
  importBatchId: string;
  variantCount: number;
};

export function mapImportBatchSummary(batch: {
  id?: string;
  orgId?: string;
  projectId?: string;
  operatorId?: string;
  sourceType?: string;
  status?: string;
  uploadSessionCount?: number;
  itemCount?: number;
  confirmedItemCount?: number;
  candidateAssetCount?: number;
  mediaAssetCount?: number;
  updatedAt?: string;
}): ImportBatchSummaryViewModel {
  return {
    id: batch.id ?? "",
    orgId: batch.orgId ?? "",
    projectId: batch.projectId ?? "",
    operatorId: batch.operatorId ?? "",
    sourceType: batch.sourceType ?? "unknown",
    status: batch.status ?? "pending",
    uploadSessionCount: batch.uploadSessionCount ?? 0,
    itemCount: batch.itemCount ?? 0,
    confirmedItemCount: batch.confirmedItemCount ?? 0,
    candidateAssetCount: batch.candidateAssetCount ?? 0,
    mediaAssetCount: batch.mediaAssetCount ?? 0,
    updatedAt: batch.updatedAt ?? "",
  };
}
