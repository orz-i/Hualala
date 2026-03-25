import { createProjectClient, type HualalaFetch } from "@hualala/sdk";
import { normalizePreviewRuntime, type PreviewRuntimeViewModel } from "./previewRuntime";

type RequestPreviewRenderOptions = {
  projectId: string;
  episodeId?: string;
  requestedLocale?: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type RequestPreviewRenderResponse = {
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
  };
};

export async function requestPreviewRender({
  projectId,
  episodeId,
  requestedLocale,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: RequestPreviewRenderOptions): Promise<PreviewRuntimeViewModel> {
  const client = createProjectClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });

  const payload = (await client.requestPreviewRender({
    projectId,
    ...(episodeId ? { episodeId } : {}),
    ...(requestedLocale ? { requestedLocale } : {}),
  })) as RequestPreviewRenderResponse;

  return normalizePreviewRuntime(
    payload.runtime,
    "creator: preview runtime payload is incomplete",
  );
}
