import { createAssetClient, type HualalaFetch } from "@hualala/sdk";
import {
  decideReuseEligibility,
  type ReusableAssetLibraryItemViewModel,
} from "./reuse";

type LoadReusableAssetLibraryOptions = {
  currentProjectId: string;
  sourceProjectId: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type ListImportBatchesResponse = {
  importBatches?: Array<{
    id?: string;
  }>;
};

type ImportBatchWorkbenchResponse = {
  importBatch?: {
    id?: string;
    projectId?: string;
    sourceType?: string;
  };
  uploadFiles?: Array<{
    id?: string;
    fileName?: string;
    mimeType?: string;
  }>;
  mediaAssets?: Array<{
    id?: string;
    projectId?: string;
    sourceType?: string;
    rightsStatus?: string;
    consentStatus?: string;
    importBatchId?: string;
    locale?: string;
    aiAnnotated?: boolean;
    mediaType?: string;
  }>;
  mediaAssetVariants?: Array<{
    id?: string;
    assetId?: string;
    uploadFileId?: string;
    mimeType?: string;
  }>;
  candidateAssets?: Array<{
    assetId?: string;
    sourceRunId?: string;
  }>;
};

export async function loadReusableAssetLibrary({
  currentProjectId,
  sourceProjectId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadReusableAssetLibraryOptions): Promise<ReusableAssetLibraryItemViewModel[]> {
  if (!sourceProjectId.trim()) {
    return [];
  }

  const client = createAssetClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });

  const listPayload = (await client.listImportBatches({
    projectId: sourceProjectId,
  })) as ListImportBatchesResponse;

  const items: ReusableAssetLibraryItemViewModel[] = [];

  const importBatchPayloadResults = await Promise.allSettled(
    (listPayload.importBatches ?? [])
      .filter((importBatch): importBatch is { id: string } => Boolean(importBatch.id))
      .map(async (importBatch) => ({
        importBatchId: importBatch.id,
        payload: (await client.getImportBatchWorkbench({
          importBatchId: importBatch.id,
        })) as ImportBatchWorkbenchResponse,
      })),
  );

  const importBatchPayloads = importBatchPayloadResults
    .filter(
      (
        result,
      ): result is PromiseFulfilledResult<{
        importBatchId: string;
        payload: ImportBatchWorkbenchResponse;
      }> => result.status === "fulfilled",
    )
    .map((result) => result.value);

  if (
    importBatchPayloads.length === 0 &&
    importBatchPayloadResults.some((result) => result.status === "rejected")
  ) {
    throw importBatchPayloadResults.find((result) => result.status === "rejected")?.reason;
  }

  for (const { importBatchId, payload } of importBatchPayloads) {
    const uploadFileById = new Map(
      (payload.uploadFiles ?? [])
        .filter((file): file is { id: string; fileName?: string; mimeType?: string } =>
          Boolean(file.id),
        )
        .map((file) => [file.id, file]),
    );

    const firstVariantByAssetId = new Map<
      string,
      { id?: string; uploadFileId?: string; mimeType?: string }
    >();
    (payload.mediaAssetVariants ?? []).forEach((variant) => {
      if (!variant.assetId || firstVariantByAssetId.has(variant.assetId)) {
        return;
      }
      firstVariantByAssetId.set(variant.assetId, variant);
    });

    const sourceRunIdByAssetId = new Map<string, string>();
    (payload.candidateAssets ?? []).forEach((candidate) => {
      if (!candidate.assetId || sourceRunIdByAssetId.has(candidate.assetId)) {
        return;
      }
      sourceRunIdByAssetId.set(candidate.assetId, candidate.sourceRunId ?? "");
    });

    (payload.mediaAssets ?? []).forEach((asset) => {
      if (!asset.id) {
        return;
      }

      const normalizedSourceProjectId =
        asset.projectId ?? payload.importBatch?.projectId ?? sourceProjectId;
      if (!normalizedSourceProjectId || normalizedSourceProjectId === currentProjectId) {
        return;
      }

      const variant = firstVariantByAssetId.get(asset.id);
      const uploadFile = variant?.uploadFileId
        ? uploadFileById.get(variant.uploadFileId)
        : undefined;
      const eligibility = decideReuseEligibility({
        currentProjectId,
        sourceProjectId: normalizedSourceProjectId,
        rightsStatus: asset.rightsStatus ?? "",
        consentStatus: asset.consentStatus ?? "",
        aiAnnotated: asset.aiAnnotated ?? false,
      });

      items.push({
        assetId: asset.id,
        sourceProjectId: normalizedSourceProjectId,
        importBatchId: asset.importBatchId ?? payload.importBatch?.id ?? importBatchId,
        fileName: uploadFile?.fileName ?? "",
        mediaType: asset.mediaType ?? "",
        sourceType: asset.sourceType ?? payload.importBatch?.sourceType ?? "",
        rightsStatus: asset.rightsStatus ?? "",
        consentStatus: eligibility.consentStatus,
        locale: asset.locale ?? "",
        aiAnnotated: asset.aiAnnotated ?? false,
        sourceRunId: sourceRunIdByAssetId.get(asset.id) ?? "",
        mimeType: variant?.mimeType ?? uploadFile?.mimeType ?? "",
        allowed: eligibility.allowed,
        blockedReason: eligibility.blockedReason,
      });
    });
  }

  return items.sort((left, right) => left.assetId.localeCompare(right.assetId));
}
