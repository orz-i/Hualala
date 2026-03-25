import { createProjectClient, type HualalaFetch } from "@hualala/sdk";
import {
  normalizeAdminPreviewRuntime,
  type AdminPreviewRuntimeViewModel,
} from "./adminPreviewRuntime";

type LoadAdminPreviewRuntimeOptions = {
  projectId: string;
  episodeId?: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type GetPreviewRuntimeResponse = {
  runtime?: {
    previewRuntimeId?: string;
    projectId?: string;
    episodeId?: string;
    assemblyId?: string;
    status?: string;
    renderWorkflowRunId?: string;
    renderStatus?: string;
    playbackAssetId?: string;
        exportAssetId?: string;
        resolvedLocale?: string;
        createdAt?: string;
        updatedAt?: string;
        playback?: {
          deliveryMode?: string;
          playbackUrl?: string;
          posterUrl?: string;
          durationMs?: number;
        };
        exportOutput?: {
          downloadUrl?: string;
          mimeType?: string;
          fileName?: string;
          sizeBytes?: number;
        };
        lastErrorCode?: string;
        lastErrorMessage?: string;
      };
};

export async function loadAdminPreviewRuntime({
  projectId,
  episodeId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadAdminPreviewRuntimeOptions): Promise<AdminPreviewRuntimeViewModel> {
  const client = createProjectClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });

  const payload = (await client.getPreviewRuntime({
    projectId,
    ...(episodeId ? { episodeId } : {}),
  })) as GetPreviewRuntimeResponse;

  return normalizeAdminPreviewRuntime(
    payload.runtime,
    "admin: preview runtime payload is incomplete",
  );
}
