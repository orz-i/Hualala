import { createProjectClient, type HualalaFetch } from "@hualala/sdk";
import { normalizeAdminPreviewWorkbench, type AdminPreviewWorkbenchViewModel } from "./adminPreview";

type LoadAdminPreviewWorkbenchOptions = {
  projectId: string;
  displayLocale?: string;
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
      shot?: {
        projectId?: string;
        projectTitle?: string;
        episodeId?: string;
        episodeTitle?: string;
        sceneId?: string;
        sceneCode?: string;
        sceneTitle?: string;
        shotId?: string;
        shotCode?: string;
        shotTitle?: string;
      };
      primaryAsset?: {
        assetId?: string;
        mediaType?: string;
        rightsStatus?: string;
        aiAnnotated?: boolean;
      };
      sourceRun?: {
        runId?: string;
        status?: string;
        triggerType?: string;
      };
    }>;
  };
};

export async function loadAdminPreviewWorkbench({
  projectId,
  displayLocale,
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
    ...(displayLocale ? { displayLocale } : {}),
  })) as GetPreviewWorkbenchResponse;

  return normalizeAdminPreviewWorkbench(
    payload.assembly,
    "admin: preview workbench payload is incomplete",
  );
}
