import { createProjectClient, type HualalaFetch } from "@hualala/sdk";
import { normalizeAdminPreviewWorkbench, type AdminPreviewWorkbenchViewModel } from "./adminPreview";

type LoadAdminPreviewWorkbenchOptions = {
  projectId: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type GetPreviewWorkbenchResponse = {
  assembly?: {
    assemblyId?: string;
    projectId?: string;
    episodeId?: string;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    items?: Array<{
      itemId?: string;
      assemblyId?: string;
      shotId?: string;
      primaryAssetId?: string;
      sourceRunId?: string;
      sequence?: number;
    }>;
  };
};

export async function loadAdminPreviewWorkbench({
  projectId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadAdminPreviewWorkbenchOptions): Promise<AdminPreviewWorkbenchViewModel> {
  const client = createProjectClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });

  const payload = (await client.getPreviewWorkbench({
    projectId,
  })) as GetPreviewWorkbenchResponse;

  return normalizeAdminPreviewWorkbench(
    payload.assembly,
    "admin: preview workbench payload is incomplete",
  );
}
