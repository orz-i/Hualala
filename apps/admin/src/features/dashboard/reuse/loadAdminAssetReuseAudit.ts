import { createHualalaClient, type HualalaFetch } from "@hualala/sdk";
import { loadAssetProvenanceDetails } from "../loadAssetProvenanceDetails";
import {
  normalizeAdminAssetReuseAudit,
  type AdminAssetReuseAuditViewModel,
} from "./adminAssetReuse";

type LoadAdminAssetReuseAuditOptions = {
  projectId: string;
  shotExecutionId: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type GetShotExecutionResponse = {
  shotExecution?: {
    id?: string;
    shotId?: string;
    projectId?: string;
    status?: string;
    primaryAssetId?: string;
  };
};

export async function loadAdminAssetReuseAudit({
  projectId,
  shotExecutionId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadAdminAssetReuseAuditOptions): Promise<AdminAssetReuseAuditViewModel> {
  const client = createHualalaClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });

  const payload = await client.unary<GetShotExecutionResponse>(
    "/hualala.execution.v1.ExecutionService/GetShotExecution",
    {
      shotExecutionId,
    },
    "admin: failed to load shot execution for asset reuse audit",
  );

  if (!payload.shotExecution?.id || !payload.shotExecution.shotId) {
    throw new Error("admin: shot execution payload is incomplete");
  }

  const normalizedShotExecution = {
    id: payload.shotExecution.id,
    shotId: payload.shotExecution.shotId,
    projectId: payload.shotExecution.projectId ?? projectId,
    status: payload.shotExecution.status ?? "unknown",
    primaryAssetId: payload.shotExecution.primaryAssetId ?? "",
  };

  const assetProvenanceDetail = normalizedShotExecution.primaryAssetId
    ? await loadAssetProvenanceDetails({
        assetId: normalizedShotExecution.primaryAssetId,
        orgId,
        userId,
        baseUrl,
        fetchFn,
      })
    : null;

  return normalizeAdminAssetReuseAudit({
    shotExecution: normalizedShotExecution,
    assetProvenanceDetail,
  });
}
