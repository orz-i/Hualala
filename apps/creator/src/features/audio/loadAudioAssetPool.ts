import { createAssetClient, type HualalaFetch } from "@hualala/sdk";
import type { AudioAssetPoolItemViewModel } from "./audioWorkbench";

type LoadAudioAssetPoolOptions = {
  projectId: string;
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
    sourceType?: string;
  };
  uploadFiles?: Array<{
    id?: string;
    fileName?: string;
    mimeType?: string;
  }>;
  mediaAssets?: Array<{
    id?: string;
    importBatchId?: string;
    mediaType?: string;
    sourceType?: string;
    rightsStatus?: string;
    locale?: string;
  }>;
  mediaAssetVariants?: Array<{
    id?: string;
    assetId?: string;
    uploadFileId?: string;
    variantType?: string;
    mimeType?: string;
    durationMs?: number;
  }>;
  candidateAssets?: Array<{
    assetId?: string;
    sourceRunId?: string;
  }>;
};

export async function loadAudioAssetPool({
  projectId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadAudioAssetPoolOptions): Promise<AudioAssetPoolItemViewModel[]> {
  const client = createAssetClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });

  const listPayload = (await client.listImportBatches({
    projectId,
  })) as ListImportBatchesResponse;

  const items: AudioAssetPoolItemViewModel[] = [];

  const importBatchPayloads = await Promise.all(
    (listPayload.importBatches ?? [])
      .filter((importBatch): importBatch is { id: string } => Boolean(importBatch.id))
      .map(async (importBatch) => ({
        importBatchId: importBatch.id,
        payload: (await client.getImportBatchWorkbench({
          importBatchId: importBatch.id,
        })) as ImportBatchWorkbenchResponse,
      })),
  );

  for (const { importBatchId, payload } of importBatchPayloads) {

    const uploadFileById = new Map(
      (payload.uploadFiles ?? [])
        .filter((file) => file.id)
        .map((file) => [file.id as string, file]),
    );
    const assetById = new Map(
      (payload.mediaAssets ?? [])
        .filter((asset) => asset.id)
        .map((asset) => [asset.id as string, asset]),
    );
    const sourceRunIdByAssetId = new Map<string, string>();

    (payload.candidateAssets ?? []).forEach((candidate) => {
      if (!candidate.assetId || sourceRunIdByAssetId.has(candidate.assetId)) {
        return;
      }
      sourceRunIdByAssetId.set(candidate.assetId, candidate.sourceRunId ?? "");
    });

    (payload.mediaAssetVariants ?? []).forEach((variant) => {
      if (!variant.id || !variant.assetId) {
        return;
      }

      const asset = assetById.get(variant.assetId);
      if (!asset || asset.mediaType !== "audio") {
        return;
      }

      const durationMs =
        typeof variant.durationMs === "number" && variant.durationMs > 0
          ? Math.trunc(variant.durationMs)
          : 0;
      if (durationMs <= 0) {
        return;
      }

      const uploadFile = variant.uploadFileId ? uploadFileById.get(variant.uploadFileId) : undefined;

      items.push({
        assetId: asset.id ?? "",
        importBatchId: asset.importBatchId ?? payload.importBatch?.id ?? importBatchId,
        durationMs,
        sourceRunId: sourceRunIdByAssetId.get(variant.assetId) ?? "",
        fileName: uploadFile?.fileName ?? "",
        mediaType: asset.mediaType ?? "",
        sourceType: asset.sourceType ?? payload.importBatch?.sourceType ?? "",
        rightsStatus: asset.rightsStatus ?? "",
        locale: asset.locale ?? "",
        variantId: variant.id,
        variantType: variant.variantType ?? "",
        mimeType: variant.mimeType ?? uploadFile?.mimeType ?? "",
      });
    });
  }

  return items.sort((left, right) => {
    const fileNameCompare = left.fileName.localeCompare(right.fileName);
    if (fileNameCompare !== 0) {
      return fileNameCompare;
    }
    return left.assetId.localeCompare(right.assetId);
  });
}
