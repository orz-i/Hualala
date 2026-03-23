import { createAssetClient, type HualalaFetch } from "@hualala/sdk";

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

type LoadImportBatchSummariesOptions = {
  projectId: string;
  status?: string;
  sourceType?: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

export async function loadImportBatchSummaries({
  projectId,
  status = "",
  sourceType = "",
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadImportBatchSummariesOptions): Promise<ImportBatchSummaryViewModel[]> {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    throw new Error("creator: projectId is required");
  }

  const client = createAssetClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });

  const payload = await client.listImportBatches({
    projectId: normalizedProjectId,
    status,
    sourceType,
  });

  return (payload.importBatches ?? []).map((batch) => ({
    id: batch.id,
    orgId: batch.orgId,
    projectId: batch.projectId,
    operatorId: batch.operatorId,
    sourceType: batch.sourceType,
    status: batch.status,
    uploadSessionCount: batch.uploadSessionCount,
    itemCount: batch.itemCount,
    confirmedItemCount: batch.confirmedItemCount,
    candidateAssetCount: batch.candidateAssetCount,
    mediaAssetCount: batch.mediaAssetCount,
    updatedAt: batch.updatedAt,
  }));
}
