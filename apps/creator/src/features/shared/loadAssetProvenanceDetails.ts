import { createAssetClient, type HualalaFetch } from "@hualala/sdk";
import type { AssetProvenanceDetailViewModel } from "./assetProvenance";

type LoadAssetProvenanceDetailsOptions = {
  assetId: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type AssetProvenanceResponse = {
  asset?: {
    id?: string;
    projectId?: string;
    sourceType?: string;
    rightsStatus?: string;
    importBatchId?: string;
    locale?: string;
    aiAnnotated?: boolean;
  };
  provenanceSummary?: string;
  candidateAssetId?: string;
  shotExecutionId?: string;
  sourceRunId?: string;
  importBatchId?: string;
  variantCount?: number;
};

export async function loadAssetProvenanceDetails({
  assetId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadAssetProvenanceDetailsOptions): Promise<AssetProvenanceDetailViewModel> {
  const client = createAssetClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });
  const payload = (await client.getAssetProvenanceSummary({
    assetId,
  })) as AssetProvenanceResponse;

  if (!payload.asset?.id) {
    throw new Error("creator: asset provenance payload is incomplete");
  }

  return {
    asset: {
      id: payload.asset.id,
      projectId: payload.asset.projectId ?? "",
      sourceType: payload.asset.sourceType ?? "unknown",
      rightsStatus: payload.asset.rightsStatus ?? "unknown",
      importBatchId: payload.asset.importBatchId ?? "",
      locale: payload.asset.locale ?? "",
      aiAnnotated: payload.asset.aiAnnotated ?? false,
    },
    provenanceSummary: payload.provenanceSummary ?? "",
    candidateAssetId: payload.candidateAssetId ?? "",
    shotExecutionId: payload.shotExecutionId ?? "",
    sourceRunId: payload.sourceRunId ?? "",
    importBatchId: payload.importBatchId ?? "",
    variantCount: payload.variantCount ?? 0,
  };
}
