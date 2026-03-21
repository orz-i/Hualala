import { createAssetClient, type HualalaFetch } from "@hualala/sdk";
import { mapImportBatchSummary, type AssetMonitorViewModel } from "./assetMonitor";

type LoadAssetMonitorPanelOptions = {
  projectId: string;
  status?: string;
  sourceType?: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

export async function loadAssetMonitorPanel({
  projectId,
  status = "",
  sourceType = "",
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadAssetMonitorPanelOptions): Promise<AssetMonitorViewModel> {
  const client = createAssetClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });

  const payload = await client.listImportBatches({
    projectId,
    status,
    sourceType,
  });

  return {
    filters: {
      status,
      sourceType,
    },
    importBatches: (payload.importBatches ?? []).map((batch) =>
      mapImportBatchSummary({
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
      }),
    ),
  };
}
