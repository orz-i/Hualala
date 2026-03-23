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
      items: previewState.items.map((item) => ({
        itemId: item.itemId,
        assemblyId: item.assemblyId,
        shotId: item.shotId,
        primaryAssetId: item.primaryAssetId,
        sourceRunId: item.sourceRunId,
        sequence: item.sequence,
      })),
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
