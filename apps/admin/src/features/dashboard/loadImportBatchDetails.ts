import { createAssetClient, type HualalaFetch } from "@hualala/sdk";
import type { ImportBatchDetailViewModel } from "./assetMonitor";

type LoadImportBatchDetailsOptions = {
  importBatchId: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type ImportBatchWorkbenchResponse = {
  importBatch?: {
    id?: string;
    orgId?: string;
    projectId?: string;
    operatorId?: string;
    sourceType?: string;
    status?: string;
  };
  uploadSessions?: Array<{
    id?: string;
    fileName?: string;
    checksum?: string;
    sizeBytes?: number | bigint;
    retryCount?: number;
    status?: string;
    resumeHint?: string;
  }>;
  items?: Array<{
    id?: string;
    status?: string;
    assetId?: string;
  }>;
  candidateAssets?: Array<{
    id?: string;
    shotExecutionId?: string;
    assetId?: string;
    sourceRunId?: string;
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
  }>;
  shotExecutions?: Array<{
    id?: string;
    shotId?: string;
    status?: string;
    primaryAssetId?: string;
    currentRunId?: string;
  }>;
};

export async function loadImportBatchDetails({
  importBatchId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadImportBatchDetailsOptions): Promise<ImportBatchDetailViewModel> {
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
  })) as ImportBatchWorkbenchResponse;

  if (!payload.importBatch?.id) {
    throw new Error("admin: import batch detail payload is incomplete");
  }

  return {
    batch: {
      id: payload.importBatch.id,
      orgId: payload.importBatch.orgId ?? "",
      projectId: payload.importBatch.projectId ?? "",
      operatorId: payload.importBatch.operatorId ?? "",
      sourceType: payload.importBatch.sourceType ?? "unknown",
      status: payload.importBatch.status ?? "pending",
    },
    uploadSessions: (payload.uploadSessions ?? []).map((session) => ({
      id: session.id ?? "",
      fileName: session.fileName ?? "",
      checksum: session.checksum ?? "",
      sizeBytes:
        typeof session.sizeBytes === "bigint"
          ? Number(session.sizeBytes)
          : (session.sizeBytes ?? 0),
      retryCount: session.retryCount ?? 0,
      status: session.status ?? "pending",
      resumeHint: session.resumeHint ?? "",
    })),
    items: (payload.items ?? []).map((item) => ({
      id: item.id ?? "",
      status: item.status ?? "pending",
      assetId: item.assetId ?? "",
    })),
    candidateAssets: (payload.candidateAssets ?? []).map((candidate) => ({
      id: candidate.id ?? "",
      shotExecutionId: candidate.shotExecutionId ?? "",
      assetId: candidate.assetId ?? "",
      sourceRunId: candidate.sourceRunId ?? "",
    })),
    mediaAssets: (payload.mediaAssets ?? []).map((asset) => ({
      id: asset.id ?? "",
      projectId: asset.projectId ?? "",
      sourceType: asset.sourceType ?? "unknown",
      rightsStatus: asset.rightsStatus ?? "unknown",
      consentStatus: asset.consentStatus ?? "unknown",
      importBatchId: asset.importBatchId ?? "",
      locale: asset.locale ?? "",
      aiAnnotated: asset.aiAnnotated ?? false,
    })),
    shotExecutions: (payload.shotExecutions ?? []).map((execution) => ({
      id: execution.id ?? "",
      shotId: execution.shotId ?? "",
      status: execution.status ?? "pending",
      primaryAssetId: execution.primaryAssetId ?? "",
      currentRunId: execution.currentRunId ?? "",
    })),
  };
}
