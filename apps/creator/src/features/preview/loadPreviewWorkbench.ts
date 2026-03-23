import { createProjectClient, type HualalaFetch } from "@hualala/sdk";
import { normalizePreviewWorkbench, type PreviewWorkbenchViewModel } from "./previewWorkbench";

type LoadPreviewWorkbenchOptions = {
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

export async function loadPreviewWorkbench({
  projectId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadPreviewWorkbenchOptions): Promise<PreviewWorkbenchViewModel> {
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

  return normalizePreviewWorkbench(
    payload.assembly,
    "creator: preview workbench payload is incomplete",
  );
}
