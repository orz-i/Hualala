export type AssetProvenanceDetailViewModel = {
  asset: {
    id: string;
    projectId: string;
    sourceType: string;
    rightsStatus: string;
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

export type AssetProvenanceStatus = "idle" | "loading" | "ready" | "error";
