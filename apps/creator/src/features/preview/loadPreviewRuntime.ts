import { createProjectClient, type HualalaFetch } from "@hualala/sdk";
import { normalizePreviewRuntime, type PreviewRuntimeViewModel } from "./previewRuntime";

type LoadPreviewRuntimeOptions = {
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

export async function loadPreviewRuntime({
  projectId,
  episodeId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadPreviewRuntimeOptions): Promise<PreviewRuntimeViewModel> {
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

  return normalizePreviewRuntime(
    payload.runtime,
    "creator: preview runtime payload is incomplete",
  );
}
