import { createAssetClient, type HualalaFetch } from "@hualala/sdk";
import type { ImportBatchWorkbenchViewModel } from "./ImportBatchWorkbenchPage";

type LoadImportBatchWorkbenchOptions = {
  importBatchId: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type GetImportBatchWorkbenchResponse = {
  importBatch?: {
    id?: string;
    status?: string;
    sourceType?: string;
  };
  uploadSessions?: Array<{
    id?: string;
    status?: string;
  }>;
  items?: Array<{
    id?: string;
    status?: string;
    assetId?: string;
  }>;
  candidateAssets?: Array<{
    id?: string;
    assetId?: string;
  }>;
  shotExecutions?: Array<{
    id?: string;
    status?: string;
    primaryAssetId?: string;
  }>;
};

export async function loadImportBatchWorkbench({
  importBatchId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadImportBatchWorkbenchOptions): Promise<ImportBatchWorkbenchViewModel> {
  const client = createAssetClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });
  const payload = (await client.getImportBatchWorkbench({
    importBatchId,
  })) as GetImportBatchWorkbenchResponse;
  if (!payload.importBatch?.id) {
    throw new Error("creator: import batch workbench payload is incomplete");
  }

  return {
    importBatch: {
      id: payload.importBatch.id,
      status: payload.importBatch.status ?? "unknown",
      sourceType: payload.importBatch.sourceType ?? "unknown",
    },
    uploadSessions: (payload.uploadSessions ?? []).map((session) => ({
      id: session.id ?? "",
      status: session.status ?? "pending",
    })),
    items: (payload.items ?? []).map((item) => ({
      id: item.id ?? "",
      status: item.status ?? "pending",
      assetId: item.assetId ?? "",
    })),
    candidateAssets: (payload.candidateAssets ?? []).map((candidate) => ({
      id: candidate.id ?? "",
      assetId: candidate.assetId ?? "",
    })),
    shotExecutions: (payload.shotExecutions ?? []).map((shotExecution) => ({
      id: shotExecution.id ?? "",
      status: shotExecution.status ?? "pending",
      primaryAssetId: shotExecution.primaryAssetId ?? "",
    })),
  };
}
