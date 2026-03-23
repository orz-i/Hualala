import { createProjectClient, type HualalaFetch } from "@hualala/sdk";
import { normalizePreviewWorkbench, type PreviewItemViewModel, type PreviewWorkbenchViewModel } from "./previewWorkbench";

type SavePreviewWorkbenchOptions = {
  projectId: string;
  status?: string;
  items: PreviewItemViewModel[];
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type UpsertPreviewAssemblyResponse = {
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

function normalizeMutationItem(item: PreviewItemViewModel, index: number) {
  return {
    itemId: item.itemId.startsWith("draft-") ? undefined : item.itemId,
    assemblyId: item.assemblyId || undefined,
    shotId: item.shotId,
    primaryAssetId: item.primaryAssetId || undefined,
    sourceRunId: item.sourceRunId || undefined,
    sequence: index + 1,
  };
}

export async function savePreviewWorkbench({
  projectId,
  status = "draft",
  items,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: SavePreviewWorkbenchOptions): Promise<PreviewWorkbenchViewModel> {
  const client = createProjectClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });

  const payload = (await client.upsertPreviewAssembly({
    projectId,
    status,
    items: items.map(normalizeMutationItem),
  })) as UpsertPreviewAssemblyResponse;

  return normalizePreviewWorkbench(
    payload.assembly,
    "creator: preview workbench payload is incomplete",
  );
}
