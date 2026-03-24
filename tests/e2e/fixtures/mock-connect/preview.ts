import type { PreviewAssemblyState } from "./types.ts";

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

function buildPreviewShotOptionCatalog(projectId: string): PreviewShotCatalogEntry[] {
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
        sceneTitle: "开场",
        shotId: "shot-preview-1",
        shotCode: "SHOT-001",
        shotTitle: "第一镜",
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
        sceneTitle: "开场",
        shotId: "shot-preview-2",
        shotCode: "SHOT-002",
        shotTitle: "第二镜",
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

function findShotCatalogEntry(projectId: string, shotId: string) {
  return buildPreviewShotOptionCatalog(projectId).find((entry) => entry.shotId === shotId);
}

function buildPreviewItemMetadata(
  previewState: PreviewAssemblyState,
  item: PreviewAssemblyState["items"][number],
) {
  const catalogEntry = findShotCatalogEntry(previewState.projectId, item.shotId);
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

export function buildPreviewWorkbenchPayload(previewState: PreviewAssemblyState) {
  return {
    assembly: {
      assemblyId: previewState.assemblyId,
      projectId: previewState.projectId,
      episodeId: previewState.episodeId,
      status: previewState.status,
      createdAt: previewState.createdAt,
      updatedAt: previewState.updatedAt,
      items: previewState.items.map((item) => {
        const metadata = buildPreviewItemMetadata(previewState, item);
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

export function buildPreviewShotOptionsPayload(previewState: PreviewAssemblyState) {
  return {
    options: buildPreviewShotOptionCatalog(previewState.projectId).map((entry) => ({
      shot: entry.shot,
      shotExecutionId: entry.shotExecutionId,
      shotExecutionStatus: entry.shotExecutionStatus,
      currentPrimaryAsset: entry.currentPrimaryAsset,
      latestRun: entry.latestRun,
    })),
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
