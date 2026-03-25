import type { PreviewAssemblyState, PreviewMode, PreviewRuntimeState } from "./types.ts";

type UpsertPreviewAssemblyBody = {
  projectId?: string;
  status?: string;
  items?: Array<{
    itemId?: string;
    assemblyId?: string;
    shotId?: string;
    primaryAssetId?: string;
    sourceRunId?: string;
    sequence?: number;
  }>;
};

type RequestPreviewRenderBody = {
  projectId?: string;
  episodeId?: string;
  requestedLocale?: string;
};

type PreviewShotCatalogEntry = {
  shotId: string;
  shot: {
    projectId: string;
    projectTitle: string;
    episodeId: string;
    episodeTitle: string;
    sceneId: string;
    sceneCode: string;
    sceneTitle: string;
    shotId: string;
    shotCode: string;
    shotTitle: string;
  };
  shotExecutionId: string;
  shotExecutionStatus: string;
  currentPrimaryAsset?: {
    assetId: string;
    mediaType: string;
    rightsStatus: string;
    aiAnnotated: boolean;
  };
  latestRun?: {
    runId: string;
    status: string;
    triggerType: string;
  };
};

const previewShotTitles: Record<string, { "en-US": string; "zh-CN": string }> = {
  "shot-preview-1": {
    "en-US": "First Shot",
    "zh-CN": "第一镜",
  },
  "shot-preview-2": {
    "en-US": "Second Shot",
    "zh-CN": "第二镜",
  },
};

function localizeSceneTitle(displayLocale: string) {
  return displayLocale === "en-US" ? "Opening" : "开场";
}

function localizeShotTitle(shotId: string, displayLocale: string) {
  const titles = previewShotTitles[shotId];
  if (!titles) {
    return "";
  }
  return displayLocale === "en-US" ? titles["en-US"] : titles["zh-CN"];
}

function buildPreviewShotOptionCatalog(
  projectId: string,
  displayLocale = "zh-CN",
): PreviewShotCatalogEntry[] {
  return [
    {
      shotId: "shot-preview-1",
      shot: {
        projectId,
        projectTitle: "项目直播一",
        episodeId: "episode-live-1",
        episodeTitle: "第一集",
        sceneId: "scene-live-1",
        sceneCode: "SCENE-001",
        sceneTitle: localizeSceneTitle(displayLocale),
        shotId: "shot-preview-1",
        shotCode: "SHOT-001",
        shotTitle: localizeShotTitle("shot-preview-1", displayLocale),
      },
      shotExecutionId: "shot-exec-preview-1",
      shotExecutionStatus: "ready",
    },
    {
      shotId: "shot-preview-2",
      shot: {
        projectId,
        projectTitle: "项目直播一",
        episodeId: "episode-live-1",
        episodeTitle: "第一集",
        sceneId: "scene-live-1",
        sceneCode: "SCENE-001",
        sceneTitle: localizeSceneTitle(displayLocale),
        shotId: "shot-preview-2",
        shotCode: "SHOT-002",
        shotTitle: localizeShotTitle("shot-preview-2", displayLocale),
      },
      shotExecutionId: "shot-exec-preview-2",
      shotExecutionStatus: "ready",
      currentPrimaryAsset: {
        assetId: "asset-preview-2",
        mediaType: "image",
        rightsStatus: "cleared",
        aiAnnotated: true,
      },
      latestRun: {
        runId: "run-preview-2",
        status: "completed",
        triggerType: "manual",
      },
    },
  ];
}

function findShotCatalogEntry(projectId: string, shotId: string, displayLocale = "zh-CN") {
  return buildPreviewShotOptionCatalog(projectId, displayLocale).find((entry) => entry.shotId === shotId);
}

function buildPreviewItemMetadata(
  previewState: PreviewAssemblyState,
  item: PreviewAssemblyState["items"][number],
  displayLocale = "zh-CN",
) {
  const catalogEntry = findShotCatalogEntry(previewState.projectId, item.shotId, displayLocale);
  if (!catalogEntry) {
    return {
      shot: null,
      primaryAsset: null,
      sourceRun: null,
    };
  }

  const primaryAsset =
    item.primaryAssetId && catalogEntry.currentPrimaryAsset?.assetId === item.primaryAssetId
      ? catalogEntry.currentPrimaryAsset
      : null;
  const sourceRun =
    item.sourceRunId && catalogEntry.latestRun?.runId === item.sourceRunId ? catalogEntry.latestRun : null;

  return {
    shot: catalogEntry.shot,
    primaryAsset,
    sourceRun,
  };
}

export function createPreviewAssemblyState(projectId: string): PreviewAssemblyState {
  const assemblyId = `assembly-${projectId}`;
  return {
    assemblyId,
    projectId,
    episodeId: "",
    status: "draft",
    createdAt: "2026-03-23T09:00:00.000Z",
    updatedAt: "2026-03-23T09:05:00.000Z",
    items: [
      {
        itemId: "item-1",
        assemblyId,
        shotId: "shot-preview-1",
        primaryAssetId: "",
        sourceRunId: "",
        sequence: 1,
      },
    ],
  };
}

function buildPreviewRuntimeId(projectId: string, episodeId: string) {
  return episodeId ? `runtime-${projectId}-${episodeId}` : `runtime-${projectId}`;
}

function buildPreviewPlaybackAssetId(projectId: string) {
  return `asset-preview-playback-${projectId}`;
}

function buildPreviewExportAssetId(projectId: string) {
  return `asset-preview-export-${projectId}`;
}

export function createPreviewRuntimeState(previewState: PreviewAssemblyState): PreviewRuntimeState {
  return {
    previewRuntimeId: buildPreviewRuntimeId(previewState.projectId, previewState.episodeId),
    projectId: previewState.projectId,
    episodeId: previewState.episodeId,
    assemblyId: previewState.assemblyId,
    status: "draft",
    renderWorkflowRunId: "",
    renderStatus: "idle",
    playbackAssetId: "",
    exportAssetId: "",
    resolvedLocale: "",
    createdAt: "2026-03-24T09:10:00.000Z",
    updatedAt: "2026-03-24T09:10:00.000Z",
    playback: null,
    exportOutput: null,
    lastErrorCode: "",
    lastErrorMessage: "",
  };
}

function buildPreviewPlaybackDelivery(projectId: string) {
  return {
    deliveryMode: "file",
    playbackUrl: `https://cdn.example.com/${projectId}/preview-runtime.mp4`,
    posterUrl: `https://cdn.example.com/${projectId}/preview-runtime.jpg`,
    durationMs: 31000,
  };
}

function buildPreviewExportOutput(projectId: string) {
  return {
    downloadUrl: `https://cdn.example.com/${projectId}/preview-export.mp4`,
    mimeType: "video/mp4",
    fileName: `preview-export-${projectId}.mp4`,
    sizeBytes: 8192,
  };
}

export function buildPreviewWorkbenchPayload(
  previewState: PreviewAssemblyState,
  displayLocale = "zh-CN",
) {
  return {
    assembly: {
      assemblyId: previewState.assemblyId,
      projectId: previewState.projectId,
      episodeId: previewState.episodeId,
      status: previewState.status,
      createdAt: previewState.createdAt,
      updatedAt: previewState.updatedAt,
      items: previewState.items.map((item) => {
        const metadata = buildPreviewItemMetadata(previewState, item, displayLocale);
        return {
          itemId: item.itemId,
          assemblyId: item.assemblyId,
          shotId: item.shotId,
          primaryAssetId: item.primaryAssetId,
          sourceRunId: item.sourceRunId,
          sequence: item.sequence,
          shot: metadata.shot ?? undefined,
          primaryAsset: metadata.primaryAsset ?? undefined,
          sourceRun: metadata.sourceRun ?? undefined,
        };
      }),
    },
  };
}

export function buildPreviewRuntimePayload(previewRuntimeState: PreviewRuntimeState) {
  return {
    runtime: {
      previewRuntimeId: previewRuntimeState.previewRuntimeId,
      projectId: previewRuntimeState.projectId,
      episodeId: previewRuntimeState.episodeId,
      assemblyId: previewRuntimeState.assemblyId,
      status: previewRuntimeState.status,
      renderWorkflowRunId: previewRuntimeState.renderWorkflowRunId,
      renderStatus: previewRuntimeState.renderStatus,
      playbackAssetId: previewRuntimeState.playbackAssetId,
      exportAssetId: previewRuntimeState.exportAssetId,
      resolvedLocale: previewRuntimeState.resolvedLocale,
      createdAt: previewRuntimeState.createdAt,
      updatedAt: previewRuntimeState.updatedAt,
      playback: previewRuntimeState.playback,
      exportOutput: previewRuntimeState.exportOutput,
      lastErrorCode: previewRuntimeState.lastErrorCode,
      lastErrorMessage: previewRuntimeState.lastErrorMessage,
    },
  };
}

export function buildPreviewShotOptionsPayload(
  previewState: PreviewAssemblyState,
  displayLocale = "zh-CN",
) {
  return {
    options: buildPreviewShotOptionCatalog(previewState.projectId, displayLocale).map((entry) => ({
      shot: entry.shot,
      shotExecutionId: entry.shotExecutionId,
      shotExecutionStatus: entry.shotExecutionStatus,
      currentPrimaryAsset: entry.currentPrimaryAsset,
      latestRun: entry.latestRun,
    })),
  };
}

export function requestPreviewRenderState(
  previewRuntimeState: PreviewRuntimeState,
  previewState: PreviewAssemblyState,
  body: RequestPreviewRenderBody,
  attempt: number,
  mode: PreviewMode = "success",
) {
  const requestedLocale = body.requestedLocale ?? previewRuntimeState.resolvedLocale ?? "zh-CN";
  const queuedRuntime: PreviewRuntimeState = {
    ...previewRuntimeState,
    status: "queued",
    renderWorkflowRunId: `workflow-preview-${attempt}`,
    renderStatus: "queued",
    resolvedLocale: requestedLocale,
    playbackAssetId: "",
    exportAssetId: "",
    playback: null,
    exportOutput: null,
    lastErrorCode: "",
    lastErrorMessage: "",
    updatedAt: "2026-03-24T09:11:00.000Z",
  };
  const settledRuntime: PreviewRuntimeState =
    mode === "failure"
      ? {
          ...queuedRuntime,
          status: "failed",
          renderStatus: "failed",
          lastErrorCode: "preview_render_failed",
          lastErrorMessage: "worker callback timeout",
          updatedAt: "2026-03-24T09:12:00.000Z",
        }
      : {
          ...queuedRuntime,
          status: "ready",
          renderStatus: "succeeded",
          playbackAssetId: buildPreviewPlaybackAssetId(previewState.projectId),
          exportAssetId: buildPreviewExportAssetId(previewState.projectId),
          playback: buildPreviewPlaybackDelivery(previewState.projectId),
          exportOutput: buildPreviewExportOutput(previewState.projectId),
          updatedAt: "2026-03-24T09:12:00.000Z",
        };

  return {
    queuedRuntime,
    settledRuntime,
    eventPayload: {
      project_id: settledRuntime.projectId,
      episode_id: settledRuntime.episodeId,
      preview_runtime_id: settledRuntime.previewRuntimeId,
      render_status: settledRuntime.renderStatus,
      render_workflow_run_id: settledRuntime.renderWorkflowRunId,
      resolved_locale: settledRuntime.resolvedLocale,
      playback_asset_id: settledRuntime.playbackAssetId,
      export_asset_id: settledRuntime.exportAssetId,
      occurred_at: settledRuntime.updatedAt,
    },
  };
}

export function upsertPreviewAssemblyState(
  previewState: PreviewAssemblyState,
  body: UpsertPreviewAssemblyBody,
): PreviewAssemblyState {
  const normalizedItems = [...(body.items ?? [])]
    .sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0))
    .map((item, index) => ({
      itemId: item.itemId && !item.itemId.startsWith("draft-") ? item.itemId : `item-${index + 1}`,
      assemblyId: previewState.assemblyId,
      shotId: item.shotId ?? "",
      primaryAssetId: item.primaryAssetId ?? "",
      sourceRunId: item.sourceRunId ?? "",
      sequence: index + 1,
    }));

  return {
    ...previewState,
    projectId: body.projectId ?? previewState.projectId,
    status: body.status ?? previewState.status,
    updatedAt: "2026-03-23T09:06:00.000Z",
    items: normalizedItems,
  };
}

export function buildPreviewAssetProvenancePayload(
  previewState: PreviewAssemblyState,
  assetId: string,
) {
  const matchedItem = previewState.items.find((item) => item.primaryAssetId === assetId);
  if (!matchedItem) {
    return null;
  }

  return {
    asset: {
      id: assetId,
      projectId: previewState.projectId,
      sourceType: "preview_manual",
      rightsStatus: "clear",
      importBatchId: "",
      locale: "zh-CN",
      aiAnnotated: true,
    },
    provenanceSummary: `preview_assembly=${previewState.assemblyId} shot_id=${matchedItem.shotId}`,
    candidateAssetId: matchedItem.itemId,
    shotExecutionId: `preview:${matchedItem.shotId}`,
    sourceRunId: matchedItem.sourceRunId,
    importBatchId: "",
    variantCount: 1,
  };
}
