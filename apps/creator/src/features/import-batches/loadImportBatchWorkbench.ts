import type { ImportBatchWorkbenchViewModel } from "./ImportBatchWorkbenchPage";

type LoadImportBatchWorkbenchOptions = {
  importBatchId: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
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

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function resolveBaseUrl(baseUrl?: string) {
  if (baseUrl && baseUrl.trim() !== "") {
    return trimTrailingSlash(baseUrl.trim());
  }
  if (typeof window !== "undefined" && window.location.origin) {
    return trimTrailingSlash(window.location.origin);
  }
  return "";
}

export async function loadImportBatchWorkbench({
  importBatchId,
  baseUrl,
  fetchFn = fetch,
}: LoadImportBatchWorkbenchOptions): Promise<ImportBatchWorkbenchViewModel> {
  const response = await fetchFn(
    `${resolveBaseUrl(baseUrl)}/hualala.asset.v1.AssetService/GetImportBatchWorkbench`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Connect-Protocol-Version": "1",
      },
      body: JSON.stringify({
        importBatchId,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `creator: failed to load import batch workbench (${response.status})`,
    );
  }

  const payload = (await response.json()) as GetImportBatchWorkbenchResponse;
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
