import { createProjectClient, type HualalaFetch } from "@hualala/sdk";
import {
  buildPreviewShotOptionLabel,
  normalizeRequiredPreviewShotSummary,
  type PreviewShotOptionViewModel,
} from "./previewWorkbench";

type LoadPreviewShotOptionsOptions = {
  projectId: string;
  episodeId?: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type ListPreviewShotOptionsResponse = {
  options?: Array<{
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
    shotExecutionId?: string;
    shotExecutionStatus?: string;
    currentPrimaryAsset?: {
      assetId?: string;
      mediaType?: string;
      rightsStatus?: string;
      aiAnnotated?: boolean;
    };
    latestRun?: {
      runId?: string;
      status?: string;
      triggerType?: string;
    };
  }>;
};

function normalizePreviewAssetSummary(
  payload:
    | {
        assetId?: string;
        mediaType?: string;
        rightsStatus?: string;
        aiAnnotated?: boolean;
      }
    | undefined,
) {
  if (!payload?.assetId) {
    return null;
  }

  return {
    assetId: payload.assetId,
    mediaType: payload.mediaType ?? "",
    rightsStatus: payload.rightsStatus ?? "",
    aiAnnotated: payload.aiAnnotated ?? false,
  };
}

function normalizePreviewRunSummary(
  payload:
    | {
        runId?: string;
        status?: string;
        triggerType?: string;
      }
    | undefined,
) {
  if (!payload?.runId) {
    return null;
  }

  return {
    runId: payload.runId,
    status: payload.status ?? "",
    triggerType: payload.triggerType ?? "",
  };
}

export async function loadPreviewShotOptions({
  projectId,
  episodeId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadPreviewShotOptionsOptions): Promise<PreviewShotOptionViewModel[]> {
  const client = createProjectClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });

  const payload = (await client.listPreviewShotOptions({
    projectId,
    episodeId,
  })) as ListPreviewShotOptionsResponse;

  return (payload.options ?? []).map((option) => {
    const shotSummary = normalizeRequiredPreviewShotSummary(
      option.shot,
      "creator: preview shot options payload is incomplete",
    );

    return {
      shotId: shotSummary.shotId,
      label: buildPreviewShotOptionLabel(shotSummary),
      shotExecutionId: option.shotExecutionId ?? "",
      shotExecutionStatus: option.shotExecutionStatus ?? "",
      shotSummary,
      currentPrimaryAssetSummary: normalizePreviewAssetSummary(option.currentPrimaryAsset),
      latestRunSummary: normalizePreviewRunSummary(option.latestRun),
    };
  });
}
